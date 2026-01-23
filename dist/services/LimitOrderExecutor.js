"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitOrderExecutor = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const LimitExecutorV2_json_1 = __importDefault(require("../abis/LimitExecutorV2.json"));
const gridTrading_1 = require("../types/gridTrading");
class LimitOrderExecutor {
    constructor(pythPriceService, gridService, tpslMonitor, limitOrderService) {
        this.isRunning = false;
        this.checkInterval = 5000;
        this.currentPrices = new Map();
        this.lastCleanupTime = 0;
        this.cleanupInterval = 30000;
        this.gridService = gridService;
        this.tpslMonitor = tpslMonitor;
        this.limitOrderService = limitOrderService;
        this.logger = new Logger_1.Logger('LimitOrderExecutor');
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.keeperWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, this.provider);
        this.priceSignerWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY);
        this.priceSignerAddress = this.priceSignerWallet.address;
        this.limitExecutorAddress = config_1.config.LIMIT_EXECUTOR_ADDRESS;
        this.limitExecutor = new ethers_1.Contract(this.limitExecutorAddress, LimitExecutorV2_json_1.default.abi, this.keeperWallet);
        this.tradingPairAddress = config_1.config.POSITION_MANAGER_ADDRESS;
        if (pythPriceService) {
            pythPriceService.onPriceUpdate((prices) => {
                Object.keys(prices).forEach((symbol) => {
                    const priceData = prices[symbol];
                    const priceWith8Decimals = BigInt(Math.round(priceData.price * 100000000));
                    this.currentPrices.set(symbol, {
                        price: priceWith8Decimals,
                        timestamp: priceData.timestamp || Date.now(),
                    });
                });
            });
            const initialPrices = pythPriceService.getCurrentPrices();
            Object.keys(initialPrices).forEach((symbol) => {
                const priceData = initialPrices[symbol];
                const priceWith8Decimals = BigInt(Math.round(priceData.price * 100000000));
                this.currentPrices.set(symbol, {
                    price: priceWith8Decimals,
                    timestamp: priceData.timestamp || Date.now(),
                });
            });
        }
        this.logger.info('🤖 Limit Order Executor initialized');
        this.logger.info(`   Keeper: ${this.keeperWallet.address}`);
        this.logger.info(`   Price Signer: ${this.priceSignerAddress}`);
        this.logger.info(`   LimitExecutor: ${this.limitExecutorAddress}`);
    }
    start() {
        if (this.isRunning) {
            this.logger.warn('⚠️  Executor already running');
            return;
        }
        this.isRunning = true;
        this.logger.info('▶️  Starting limit order executor...');
        this.monitorLoop();
    }
    stop() {
        this.isRunning = false;
        this.logger.info('⏹️  Stopping limit order executor...');
    }
    async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkAndExecuteOrders();
                if (this.gridService && Date.now() - this.lastCleanupTime > this.cleanupInterval) {
                    await this.cleanupExpiredGridCells();
                    this.lastCleanupTime = Date.now();
                }
            }
            catch (error) {
                this.logger.error('Error in monitor loop:', error);
            }
            await this.sleep(this.checkInterval);
        }
    }
    async cleanupExpiredGridCells() {
        if (!this.gridService)
            return;
        try {
            const expiredCount = this.gridService.cleanupExpiredCells();
            if (expiredCount > 0) {
                this.logger.info(`🧹 Cleaned up ${expiredCount} expired grid cells`);
            }
        }
        catch (error) {
            this.logger.error('Error cleaning up expired cells:', error);
        }
    }
    shouldExecuteGridOrder(orderId) {
        if (!this.gridService)
            return true;
        try {
            const activeCells = this.gridService.getActiveCells();
            const cell = activeCells.find(c => c.orderIds.includes(orderId));
            if (!cell) {
                return true;
            }
            const now = Math.floor(Date.now() / 1000);
            if (now < cell.startTime) {
                this.logger.debug(`⏰ Order ${orderId} not yet in time window (starts at ${cell.startTime})`);
                return false;
            }
            if (now > cell.endTime) {
                this.logger.warn(`⏰ Order ${orderId} time window expired (ended at ${cell.endTime})`);
                this.gridService.updateCellStatus(cell.id, gridTrading_1.GridCellStatus.EXPIRED);
                return false;
            }
            return true;
        }
        catch (error) {
            this.logger.error('Error checking grid order time window:', error);
            return true;
        }
    }
    async checkAndExecuteOrders() {
        try {
            const nextOrderId = await this.limitExecutor.nextOrderId();
            const currentOrderId = Number(nextOrderId);
            if (currentOrderId === 1) {
                return;
            }
            const startId = Math.max(1, currentOrderId - 100);
            for (let orderId = startId; orderId < currentOrderId; orderId++) {
                try {
                    const order = await this.limitExecutor.getOrder(orderId);
                    if (order.status !== 0n)
                        continue;
                    const isCancelled = await this.limitExecutor.cancelledOrders(orderId);
                    if (isCancelled)
                        continue;
                    const now = Math.floor(Date.now() / 1000);
                    if (now >= Number(order.expiresAt)) {
                        this.logger.warn(`⏰ Order ${orderId} expired`);
                        continue;
                    }
                    const priceData = this.currentPrices.get(order.symbol);
                    if (!priceData) {
                        continue;
                    }
                    if (Date.now() - priceData.timestamp > 60000) {
                        this.logger.warn(`⏰ Stale price for ${order.symbol}`);
                        continue;
                    }
                    const currentPrice = priceData.price;
                    const triggerPrice = order.triggerPrice;
                    let shouldExecute = false;
                    if (order.orderType === 0n) {
                        if (order.isLong) {
                            shouldExecute = currentPrice <= triggerPrice;
                        }
                        else {
                            shouldExecute = currentPrice >= triggerPrice;
                        }
                    }
                    else if (order.orderType === 1n) {
                        if (order.isLong) {
                            shouldExecute = currentPrice >= triggerPrice;
                        }
                        else {
                            shouldExecute = currentPrice <= triggerPrice;
                        }
                    }
                    else if (order.orderType === 2n) {
                        if (order.isLong) {
                            shouldExecute = currentPrice <= triggerPrice;
                        }
                        else {
                            shouldExecute = currentPrice >= triggerPrice;
                        }
                    }
                    if (shouldExecute) {
                        const canExecute = this.shouldExecuteGridOrder(orderId.toString());
                        if (!canExecute) {
                            continue;
                        }
                        this.logger.info(`🎯 Trigger met for order ${orderId}!`);
                        this.logger.info(`   Symbol: ${order.symbol}`);
                        this.logger.info(`   Current: ${this.formatPrice(currentPrice)}, Trigger: ${this.formatPrice(triggerPrice)}`);
                        await this.executeOrder(order, currentPrice);
                    }
                }
                catch (error) {
                    if (!error.message?.includes('Order not found')) {
                        this.logger.error(`Error checking order ${orderId}:`, error);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Error checking orders:', error);
        }
    }
    async executeOrder(order, currentPrice) {
        const orderId = Number(order.id);
        try {
            this.logger.info(`🚀 Executing order ${orderId}...`);
            const timestamp = Math.floor(Date.now() / 1000) - 60;
            const signedPrice = await this.signPrice(order.symbol, currentPrice, timestamp);
            this.logger.info('Price signature details:', {
                symbol: signedPrice.symbol,
                price: this.formatPrice(signedPrice.price),
                timestamp: signedPrice.timestamp,
                signer: this.priceSignerAddress,
                signature: signedPrice.signature.substring(0, 20) + '...',
            });
            let tx;
            if (order.orderType === 0n) {
                tx = await this.limitExecutor.executeLimitOpenOrder(orderId, signedPrice, { gasLimit: 600000 });
            }
            else if (order.orderType === 1n) {
                tx = await this.limitExecutor.executeLimitCloseOrder(orderId, signedPrice, { gasLimit: 500000 });
            }
            else if (order.orderType === 2n) {
                tx = await this.limitExecutor.executeStopLossOrder(orderId, signedPrice, { gasLimit: 500000 });
            }
            else {
                throw new Error(`Unknown order type: ${order.orderType}`);
            }
            this.logger.info(`📤 Execution tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            this.logger.success(`✅ Order ${orderId} executed successfully!`);
            this.logger.info(`   TX: ${receipt.hash}`);
            this.logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            if (order.orderType === 0n && this.tpslMonitor && this.limitOrderService) {
                try {
                    let positionId;
                    const positionOpenedTopic = ethers_1.ethers.id('PositionOpened(uint256,address,string,bool,uint256,uint256,uint256,uint256)');
                    for (const log of receipt.logs) {
                        if (log.address.toLowerCase() === this.tradingPairAddress.toLowerCase() &&
                            log.topics[0] === positionOpenedTopic) {
                            if (log.topics.length > 1) {
                                positionId = parseInt(log.topics[1], 16);
                                this.logger.info(`🎯 Extracted position ID from event: ${positionId}`);
                                break;
                            }
                        }
                    }
                    if (positionId) {
                        this.logger.info('⏳ Waiting for blockchain to finalize position data...');
                        await this.sleep(2000);
                        await this.autoSetTPSLDirect(orderId, positionId, order.trader);
                    }
                    else {
                        this.logger.warn(`⚠️ Could not extract position ID from receipt for order ${orderId}`);
                    }
                }
                catch (tpslError) {
                    this.logger.error(`Failed to auto-set TP/SL for order ${orderId}:`, tpslError);
                }
            }
        }
        catch (error) {
            this.logger.error(`❌ Failed to execute order ${orderId}:`, error.message);
            if (error.receipt) {
                this.logger.error('Transaction failed on-chain:', {
                    txHash: error.receipt.hash,
                    status: error.receipt.status,
                    gasUsed: error.receipt.gasUsed.toString(),
                    blockNumber: error.receipt.blockNumber,
                });
            }
            try {
                const signedPrice = await this.signPrice(order.symbol, currentPrice, Math.floor(Date.now() / 1000));
                await this.limitExecutor.executeLimitOpenOrder.staticCall(orderId, signedPrice);
            }
            catch (simulateError) {
                let revertReason = 'Unknown';
                let decodedError = '';
                if (simulateError.data) {
                    revertReason = simulateError.data;
                    if (revertReason.startsWith('0x08c379a0')) {
                        try {
                            const errorData = '0x' + revertReason.slice(10);
                            const decoded = ethers_1.ethers.AbiCoder.defaultAbiCoder().decode(['string'], errorData);
                            decodedError = decoded[0];
                            this.logger.info(`Decoded error: "${decodedError}"`);
                        }
                        catch (e) {
                            this.logger.warn('Failed to decode error hex:', e);
                        }
                    }
                }
                else if (simulateError.reason) {
                    revertReason = simulateError.reason;
                }
                else if (simulateError.message) {
                    revertReason = simulateError.message;
                }
                const errorText = decodedError || revertReason;
                this.logger.error('Contract revert reason:', errorText);
                if (errorText.includes('USDC transfer failed') || errorText.includes('ERC20: insufficient allowance')) {
                    this.logger.warn('💰 User needs to approve USDC or has insufficient balance');
                }
                else if (errorText.includes('Price not reached')) {
                    this.logger.warn('📊 Price condition not met (race condition)');
                }
                else if (errorText.includes('Order expired')) {
                    this.logger.warn('⏰ Order has expired');
                }
                else if (errorText.includes('Invalid signature') || errorText.includes('Invalid price signature')) {
                    this.logger.warn('🔏 Invalid price signature');
                }
                else if (errorText.includes('Trade validation failed')) {
                    this.logger.warn('⚠️  RiskManager rejected the trade - check leverage/collateral limits');
                }
                else if (errorText.includes('Price in future')) {
                    this.logger.warn('⏱️  Price timestamp is in the future (clock drift)');
                }
            }
        }
    }
    async signPrice(symbol, price, timestamp) {
        const messageHash = ethers_1.ethers.solidityPackedKeccak256(['string', 'uint256', 'uint256'], [symbol, price, timestamp]);
        const signature = await this.priceSignerWallet.signMessage(ethers_1.ethers.getBytes(messageHash));
        return {
            symbol,
            price,
            timestamp,
            signature,
        };
    }
    formatPrice(price) {
        return '$' + (Number(price) / 100000000).toFixed(2);
    }
    formatUsdc(amount) {
        return (Number(amount) / 1000000).toFixed(2) + ' USDC';
    }
    async autoSetTPSLDirect(orderId, positionId, traderAddress) {
        try {
            const tpslData = this.limitOrderService.getOrderTPSL(orderId.toString());
            if (!tpslData || (!tpslData.takeProfit && !tpslData.stopLoss)) {
                this.logger.debug(`No TP/SL configured for order ${orderId}`);
                return;
            }
            this.logger.info(`🎯 Auto-setting TP/SL for position ${positionId}...`);
            await this.tpslMonitor.setTPSL(positionId, traderAddress, tpslData.takeProfit, tpslData.stopLoss);
            this.logger.success(`✅ Auto-set TP/SL for position ${positionId}!`);
            if (tpslData.takeProfit) {
                this.logger.info(`   TP: ${this.formatPrice(tpslData.takeProfit)}`);
            }
            if (tpslData.stopLoss) {
                this.logger.info(`   SL: ${this.formatPrice(tpslData.stopLoss)}`);
            }
            this.limitOrderService.clearOrderTPSL(orderId.toString());
        }
        catch (error) {
            this.logger.error('Error in autoSetTPSLDirect:', error);
            throw error;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            trackedPrices: Array.from(this.currentPrices.keys()),
            keeperAddress: this.keeperWallet.address,
        };
    }
}
exports.LimitOrderExecutor = LimitOrderExecutor;
//# sourceMappingURL=LimitOrderExecutor.js.map