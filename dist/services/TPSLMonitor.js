"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TPSLMonitor = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const PositionManager_json_1 = __importDefault(require("../abis/PositionManager.json"));
const MarketExecutor_json_1 = __importDefault(require("../abis/MarketExecutor.json"));
class TPSLMonitor {
    constructor(pythPriceService) {
        this.isRunning = false;
        this.checkInterval = 2000;
        this.currentPrices = new Map();
        this.tpslConfigs = new Map();
        this.logger = new Logger_1.Logger('TPSLMonitor');
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.keeperWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, this.provider);
        this.priceSignerWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY);
        this.positionManager = new ethers_1.Contract(config_1.config.POSITION_MANAGER_ADDRESS, PositionManager_json_1.default.abi, this.keeperWallet);
        this.marketExecutor = new ethers_1.Contract(config_1.config.MARKET_EXECUTOR_ADDRESS, MarketExecutor_json_1.default.abi, this.keeperWallet);
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
        this.logger.info('🎯 TP/SL Monitor initialized');
        this.logger.info(`   Keeper: ${this.keeperWallet.address}`);
        this.logger.info(`   Position Manager: ${config_1.config.POSITION_MANAGER_ADDRESS}`);
        this.logger.info(`   Market Executor: ${config_1.config.MARKET_EXECUTOR_ADDRESS}`);
    }
    start() {
        if (this.isRunning) {
            this.logger.warn('⚠️  TP/SL Monitor already running');
            return;
        }
        this.isRunning = true;
        this.logger.info('▶️  Starting TP/SL monitor...');
        this.monitorLoop();
    }
    stop() {
        this.isRunning = false;
        this.logger.info('⏹️  Stopping TP/SL monitor...');
    }
    async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkAllTPSL();
            }
            catch (error) {
                this.logger.error('Error in TP/SL monitor loop:', error);
            }
            await this.sleep(this.checkInterval);
        }
    }
    async checkAllTPSL() {
        try {
            if (this.tpslConfigs.size === 0) {
                return;
            }
            for (const [positionId, config] of this.tpslConfigs.entries()) {
                try {
                    const position = await this.getPosition(positionId);
                    if (!position || position.status !== 0) {
                        this.tpslConfigs.delete(positionId);
                        this.logger.info(`🗑️  Removed TP/SL config for closed position ${positionId}`);
                        continue;
                    }
                    await this.checkTPSLTrigger(position, config);
                }
                catch (error) {
                    if (!error.message?.includes('Position not found')) {
                        this.logger.error(`Error checking TP/SL for position ${positionId}:`, error);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Error checking all TP/SL:', error);
        }
    }
    async getPosition(positionId) {
        try {
            const positionData = await this.positionManager.getPosition(positionId);
            return {
                id: positionData.id,
                trader: positionData.trader,
                symbol: positionData.symbol,
                isLong: positionData.isLong,
                collateral: positionData.collateral,
                size: positionData.size,
                leverage: positionData.leverage,
                entryPrice: positionData.entryPrice,
                openTimestamp: positionData.openTimestamp,
                status: Number(positionData.status),
            };
        }
        catch (error) {
            return null;
        }
    }
    async checkTPSLTrigger(position, config) {
        try {
            const priceData = this.currentPrices.get(position.symbol);
            if (!priceData) {
                return;
            }
            if (Date.now() - priceData.timestamp > 60000) {
                return;
            }
            const currentPrice = priceData.price;
            let shouldClose = false;
            let reason = '';
            if (config.takeProfit) {
                if (position.isLong && currentPrice >= config.takeProfit) {
                    shouldClose = true;
                    reason = 'Take Profit Hit (Long)';
                }
                else if (!position.isLong && currentPrice <= config.takeProfit) {
                    shouldClose = true;
                    reason = 'Take Profit Hit (Short)';
                }
            }
            if (config.stopLoss) {
                if (position.isLong && currentPrice <= config.stopLoss) {
                    shouldClose = true;
                    reason = 'Stop Loss Hit (Long)';
                }
                else if (!position.isLong && currentPrice >= config.stopLoss) {
                    shouldClose = true;
                    reason = 'Stop Loss Hit (Short)';
                }
            }
            if (shouldClose) {
                this.logger.warn(`🎯 ${reason} - Position ${position.id}`);
                this.logger.info(`   Entry: ${this.formatPrice(position.entryPrice)}`);
                this.logger.info(`   Current: ${this.formatPrice(currentPrice)}`);
                if (config.takeProfit) {
                    this.logger.info(`   TP: ${this.formatPrice(config.takeProfit)}`);
                }
                if (config.stopLoss) {
                    this.logger.info(`   SL: ${this.formatPrice(config.stopLoss)}`);
                }
                await this.closePosition(position, currentPrice, reason);
            }
        }
        catch (error) {
            this.logger.error(`Error checking TP/SL trigger for position ${position.id}:`, error);
        }
    }
    async closePosition(position, currentPrice, reason) {
        try {
            this.logger.info(`📤 Closing position ${position.id} (${reason})...`);
            const pnl = await this.positionManager.calculatePnL(position.id, currentPrice);
            this.logger.info(`   📊 Position details:`);
            this.logger.info(`   - Collateral: ${position.collateral.toString()}`);
            this.logger.info(`   - Size: ${position.size.toString()}`);
            this.logger.info(`   - Leverage: ${position.leverage.toString()}`);
            this.logger.info(`   - PnL: ${pnl.toString()}`);
            const tx = await this.positionManager.closePosition(position.id, currentPrice, { gasLimit: 500000 });
            this.logger.info(`📤 Close tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            this.logger.success(`✅ Position ${position.id} closed successfully! (${reason})`);
            this.logger.info(`   TX: ${receipt.hash}`);
            this.logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            this.logger.info('⏳ Waiting for nonce to update...');
            await this.sleep(2000);
            const TRADING_FEE_BPS = 5n;
            const tradingFee = (position.collateral * TRADING_FEE_BPS) / 10000n;
            const keeperFee = (tradingFee * 2000n) / 10000n;
            const treasuryFee = tradingFee - keeperFee;
            this.logger.info(`💰 Fee breakdown (from collateral):`);
            this.logger.info(`   Collateral: ${(Number(position.collateral) / 1e6).toFixed(6)} USDC`);
            this.logger.info(`   Total fee: ${(Number(tradingFee) / 1e6).toFixed(6)} USDC (0.05% of collateral)`);
            this.logger.info(`   Keeper fee: ${(Number(keeperFee) / 1e6).toFixed(6)} USDC (0.01% of collateral)`);
            this.logger.info(`   Treasury fee: ${(Number(treasuryFee) / 1e6).toFixed(6)} USDC (0.04% of collateral)`);
            let refundAmount;
            if (pnl >= 0) {
                refundAmount = position.collateral + BigInt(pnl) - tradingFee;
            }
            else {
                const absLoss = BigInt(-pnl);
                if (position.collateral > absLoss + tradingFee) {
                    refundAmount = position.collateral - absLoss - tradingFee;
                }
                else {
                    refundAmount = 0n;
                }
            }
            this.logger.info(`💰 Settlement:`);
            this.logger.info(`   Refund to trader: ${refundAmount.toString()}`);
            const treasuryIface = new ethers_1.ethers.Interface([
                'function refundCollateral(address to, uint256 amount)',
                'function collectFee(address from, uint256 amount)'
            ]);
            const nonce = await this.provider.getTransactionCount(this.keeperWallet.address, 'pending');
            if (treasuryFee > 0n) {
                const feeData = treasuryIface.encodeFunctionData('collectFee', [
                    position.trader,
                    treasuryFee
                ]);
                const feeTx = await this.keeperWallet.sendTransaction({
                    to: treasuryManagerAddress,
                    data: feeData,
                    gasLimit: 200000n,
                    nonce: nonce
                });
                this.logger.info(`📤 Treasury fee TX: ${feeTx.hash}`);
                await feeTx.wait();
                this.logger.success(`✅ Treasury fee collected: ${treasuryFee.toString()}`);
            }
            if (keeperFee > 0n) {
                const keeperFeeTx = await this.keeperWallet.sendTransaction({
                    to: treasuryManagerAddress,
                    data: treasuryIface.encodeFunctionData('refundCollateral', [
                        this.keeperWallet.address,
                        keeperFee
                    ]),
                    gasLimit: 200000n,
                    nonce: nonce + 1
                });
                this.logger.info(`📤 Keeper fee TX: ${keeperFeeTx.hash}`);
                await keeperFeeTx.wait();
                this.logger.success(`✅ Keeper fee paid: ${keeperFee.toString()}`);
            }
            if (refundAmount > 0n) {
                const refundData = treasuryIface.encodeFunctionData('refundCollateral', [
                    position.trader,
                    refundAmount
                ]);
                const refundTx = await this.keeperWallet.sendTransaction({
                    to: treasuryManagerAddress,
                    data: refundData,
                    gasLimit: 200000n,
                    nonce: nonce + 2
                });
                this.logger.info(`📤 Refund TX: ${refundTx.hash}`);
                await refundTx.wait();
                this.logger.success(`✅ Refunded ${refundAmount.toString()} to trader!`);
            }
            this.tpslConfigs.delete(Number(position.id));
        }
        catch (error) {
            this.logger.error(`❌ Failed to close position ${position.id}:`, error.message);
            this.logger.error(`   Full error:`, error);
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
    async setTPSL(positionId, trader, takeProfit, stopLoss) {
        try {
            const position = await this.getPosition(positionId);
            this.logger.info(`Validating position ${positionId}:`);
            this.logger.info(`  Position found: ${!!position}`);
            if (position) {
                this.logger.info(`  Status: ${position.status} (type: ${typeof position.status})`);
                this.logger.info(`  Status === 0: ${position.status === 0}`);
                this.logger.info(`  Status == 0: ${position.status == 0}`);
                this.logger.info(`  Trader: ${position.trader}`);
                this.logger.info(`  Symbol: ${position.symbol}`);
            }
            if (!position) {
                return {
                    success: false,
                    message: 'Position not found'
                };
            }
            if (position.status != 0) {
                this.logger.error(`Position ${positionId} status check failed: ${position.status} != 0`);
                return {
                    success: false,
                    message: `Position is not open (status: ${position.status})`
                };
            }
            if (position.trader.toLowerCase() !== trader.toLowerCase()) {
                return {
                    success: false,
                    message: 'Not your position'
                };
            }
            if (takeProfit) {
                if (position.isLong && takeProfit <= position.entryPrice) {
                    return {
                        success: false,
                        message: 'Take Profit must be above entry price for Long positions'
                    };
                }
                if (!position.isLong && takeProfit >= position.entryPrice) {
                    return {
                        success: false,
                        message: 'Take Profit must be below entry price for Short positions'
                    };
                }
            }
            if (stopLoss) {
                this.logger.info(`SL set at ${this.formatPrice(stopLoss)} (Entry: ${this.formatPrice(position.entryPrice)})`);
            }
            const now = Date.now();
            const existingConfig = this.tpslConfigs.get(positionId);
            const config = {
                positionId,
                trader: position.trader,
                symbol: position.symbol,
                isLong: position.isLong,
                entryPrice: position.entryPrice,
                takeProfit,
                stopLoss,
                createdAt: existingConfig?.createdAt || now,
                updatedAt: now
            };
            this.tpslConfigs.set(positionId, config);
            this.logger.success(`✅ TP/SL ${existingConfig ? 'updated' : 'set'} for position ${positionId}`);
            this.logger.info(`   Entry: ${this.formatPrice(position.entryPrice)}`);
            if (takeProfit) {
                this.logger.info(`   TP: ${this.formatPrice(takeProfit)}`);
            }
            if (stopLoss) {
                this.logger.info(`   SL: ${this.formatPrice(stopLoss)}`);
            }
            return {
                success: true,
                message: `TP/SL ${existingConfig ? 'updated' : 'set'} successfully`,
                config
            };
        }
        catch (error) {
            this.logger.error(`Error setting TP/SL for position ${positionId}:`, error);
            return {
                success: false,
                message: error.message || 'Failed to set TP/SL'
            };
        }
    }
    getTPSL(positionId) {
        return this.tpslConfigs.get(positionId);
    }
    getAllTPSL() {
        return Array.from(this.tpslConfigs.values());
    }
    deleteTPSL(positionId, trader) {
        const config = this.tpslConfigs.get(positionId);
        if (!config) {
            return {
                success: false,
                message: 'TP/SL config not found'
            };
        }
        if (config.trader.toLowerCase() !== trader.toLowerCase()) {
            return {
                success: false,
                message: 'Not your position'
            };
        }
        this.tpslConfigs.delete(positionId);
        this.logger.info(`🗑️  TP/SL config deleted for position ${positionId}`);
        return {
            success: true,
            message: 'TP/SL deleted successfully'
        };
    }
    formatPrice(price) {
        return '$' + (Number(price) / 100000000).toFixed(2);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            activeTPSLCount: this.tpslConfigs.size,
            trackedPrices: Array.from(this.currentPrices.keys()),
            keeperAddress: this.keeperWallet.address,
        };
    }
}
exports.TPSLMonitor = TPSLMonitor;
//# sourceMappingURL=TPSLMonitor.js.map