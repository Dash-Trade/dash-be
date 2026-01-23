"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TapToTradeExecutor = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const TapToTradeExecutor_json_1 = __importDefault(require("../abis/TapToTradeExecutor.json"));
class TapToTradeExecutor {
    constructor(pythPriceService, tapToTradeService) {
        this.isRunning = false;
        this.checkInterval = 3000;
        this.currentPrices = new Map();
        this.lastCleanupTime = 0;
        this.cleanupInterval = 30000;
        this.tapToTradeService = tapToTradeService;
        this.logger = new Logger_1.Logger('TapToTradeExecutor');
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.keeperWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, this.provider);
        this.priceSignerWallet = new ethers_1.ethers.Wallet(config_1.config.PRICE_SIGNER_PRIVATE_KEY);
        this.priceSignerAddress = this.priceSignerWallet.address;
        this.tapToTradeExecutorAddress = config_1.config.TAP_TO_TRADE_EXECUTOR_ADDRESS;
        this.tapToTradeExecutor = new ethers_1.Contract(this.tapToTradeExecutorAddress, TapToTradeExecutor_json_1.default.abi, this.keeperWallet);
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
        this.logger.info('🚀 Tap-to-Trade Executor initialized');
        this.logger.info(`   Keeper: ${this.keeperWallet.address}`);
        this.logger.info(`   Price Signer: ${this.priceSignerAddress}`);
        this.logger.info(`   TapToTradeExecutor: ${this.tapToTradeExecutorAddress}`);
    }
    start() {
        if (this.isRunning) {
            this.logger.warn('⚠️  Tap-to-Trade Executor already running');
            return;
        }
        this.isRunning = true;
        this.logger.info('▶️  Starting tap-to-trade executor...');
        this.monitorLoop();
    }
    stop() {
        this.isRunning = false;
        this.logger.info('⏹️  Stopping tap-to-trade executor...');
    }
    async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkAndExecuteOrders();
                if (Date.now() - this.lastCleanupTime > this.cleanupInterval) {
                    await this.cleanupExpiredOrders();
                    this.lastCleanupTime = Date.now();
                }
            }
            catch (error) {
                this.logger.error('Error in monitor loop:', error);
            }
            await this.sleep(this.checkInterval);
        }
    }
    async cleanupExpiredOrders() {
        try {
            const expiredCount = this.tapToTradeService.cleanupExpiredOrders();
            if (expiredCount > 0) {
                this.logger.info(`🧹 Cleaned up ${expiredCount} expired tap-to-trade orders`);
            }
        }
        catch (error) {
            this.logger.error('Error cleaning up expired orders:', error);
        }
    }
    async checkAndExecuteOrders() {
        try {
            const pendingOrders = this.tapToTradeService.getPendingOrders();
            if (pendingOrders.length === 0) {
                return;
            }
            const now = Math.floor(Date.now() / 1000);
            for (const order of pendingOrders) {
                try {
                    if (now < order.startTime) {
                        continue;
                    }
                    if (now > order.endTime) {
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
                    const triggerPrice = BigInt(order.triggerPrice);
                    let shouldExecute = false;
                    if (order.isLong) {
                        shouldExecute = currentPrice <= triggerPrice;
                    }
                    else {
                        shouldExecute = currentPrice >= triggerPrice;
                    }
                    if (shouldExecute) {
                        this.logger.info(`🎯 Tap-to-Trade trigger met for order ${order.id}!`);
                        this.logger.info(`   Symbol: ${order.symbol}`);
                        this.logger.info(`   Current: ${this.formatPrice(currentPrice)}, Trigger: ${this.formatPrice(triggerPrice)}`);
                        await this.executeOrder(order, currentPrice);
                    }
                }
                catch (error) {
                    this.logger.error(`Error checking order ${order.id}:`, error);
                }
            }
        }
        catch (error) {
            this.logger.error('Error checking tap-to-trade orders:', error);
        }
    }
    async executeOrder(order, currentPrice) {
        try {
            this.logger.info(`🚀 Executing tap-to-trade order ${order.id}...`);
            this.tapToTradeService.markAsExecuting(order.id);
            const timestamp = Math.floor(Date.now() / 1000) - 60;
            const signedPrice = await this.signPrice(order.symbol, currentPrice, timestamp);
            this.logger.info('Price signature details:', {
                symbol: signedPrice.symbol,
                price: this.formatPrice(signedPrice.price),
                timestamp: signedPrice.timestamp,
                signer: this.priceSignerAddress,
                signature: signedPrice.signature.substring(0, 20) + '...',
            });
            this.logger.info('Execution parameters:', {
                trader: order.trader,
                symbol: order.symbol,
                isLong: order.isLong,
                collateral: order.collateral,
                leverage: order.leverage,
                nonce: order.nonce,
                price: this.formatPrice(signedPrice.price),
            });
            this.logger.info('User signature details:', {
                signature: order.signature,
                signatureLength: order.signature.length,
                contractAddress: this.tapToTradeExecutorAddress,
            });
            const currentNonceOnChain = await this.tapToTradeExecutor.metaNonces(order.trader);
            this.logger.info('Nonce validation:', {
                orderNonce: order.nonce,
                currentNonceOnChain: currentNonceOnChain.toString(),
                match: order.nonce === currentNonceOnChain.toString(),
            });
            if (order.nonce !== currentNonceOnChain.toString()) {
                this.logger.warn('\u274c Nonce mismatch! Order signature is stale.');
                this.logger.warn(`   Order was signed with nonce ${order.nonce}, but contract nonce is now ${currentNonceOnChain.toString()}`);
                this.logger.warn('   This usually happens when another order was executed after this order was created.');
                this.logger.warn('   Marking order as NEEDS_RESIGN. Frontend will request user to re-sign...');
                this.tapToTradeService.markAsNeedsResign(order.id, `Nonce mismatch: order nonce=${order.nonce}, contract nonce=${currentNonceOnChain.toString()}. Re-signature required.`);
                return;
            }
            const expectedMessageHash = ethers_1.ethers.solidityPackedKeccak256(['address', 'string', 'bool', 'uint256', 'uint256', 'uint256', 'address'], [
                order.trader,
                order.symbol,
                order.isLong,
                BigInt(order.collateral),
                BigInt(order.leverage),
                BigInt(order.nonce),
                this.tapToTradeExecutorAddress
            ]);
            this.logger.info('Expected message hash for signature:', expectedMessageHash);
            try {
                const digest = ethers_1.ethers.hashMessage(ethers_1.ethers.getBytes(expectedMessageHash));
                const recoveredSigner = ethers_1.ethers.recoverAddress(digest, order.signature);
                this.logger.info('🔍 Pre-execution signature verification:', {
                    messageHash: expectedMessageHash,
                    digest,
                    recoveredSigner,
                    expectedTrader: order.trader,
                    hasSessionKey: !!order.sessionKey,
                    sessionKeyAddress: order.sessionKey?.address,
                });
                const isValidSigner = recoveredSigner.toLowerCase() === order.trader.toLowerCase() ||
                    (order.sessionKey && recoveredSigner.toLowerCase() === order.sessionKey.address.toLowerCase());
                if (!isValidSigner) {
                    const errorMsg = `Signature verification failed: recovered=${recoveredSigner}, expected=${order.trader}${order.sessionKey ? ` or session key ${order.sessionKey.address}` : ''}`;
                    this.logger.error('❌', errorMsg);
                    this.tapToTradeService.markAsFailed(order.id, errorMsg);
                    return;
                }
                this.logger.info('✅ Pre-execution signature verification passed');
            }
            catch (sigErr) {
                this.logger.error('❌ Pre-execution signature verification error:', sigErr.message);
                this.tapToTradeService.markAsFailed(order.id, `Signature verification error: ${sigErr.message}`);
                return;
            }
            let tx;
            if (order.sessionKey) {
                this.logger.info('🔑 Order has session key - using keeper-only execution');
                this.logger.info('⚡ Backend validated session signature off-chain, keeper executes without on-chain verification');
                tx = await this.tapToTradeExecutor.executeTapToTradeByKeeper(order.trader, order.symbol, order.isLong, BigInt(order.collateral), BigInt(order.leverage), signedPrice, { gasLimit: 800000 });
                this.logger.info('✅ Keeper execution successful (fully gasless for user!)');
            }
            else {
                this.logger.info('📝 Order has traditional signature - using meta-transaction flow');
                tx = await this.tapToTradeExecutor.executeTapToTrade(order.trader, order.symbol, order.isLong, BigInt(order.collateral), BigInt(order.leverage), signedPrice, order.signature, { gasLimit: 800000 });
            }
            this.logger.info(`📤 Execution tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            let positionId = '0';
            for (const log of receipt.logs) {
                try {
                    const parsed = this.tapToTradeExecutor.interface.parseLog({
                        topics: log.topics,
                        data: log.data,
                    });
                    if (parsed && parsed.name === 'MarketOrderExecuted') {
                        positionId = parsed.args.positionId.toString();
                        break;
                    }
                }
                catch (e) {
                }
            }
            this.tapToTradeService.markAsExecuted(order.id, receipt.hash, positionId, currentPrice.toString());
            this.logger.success(`✅ Tap-to-Trade order ${order.id} executed successfully!`);
            this.logger.info(`   Position ID: ${positionId}`);
            this.logger.info(`   TX: ${receipt.hash}`);
            this.logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to execute tap-to-trade order ${order.id}:`, error.message);
            this.tapToTradeService.markAsFailed(order.id, error.message || 'Execution failed');
            if (error.receipt) {
                this.logger.error('Transaction failed on-chain:', {
                    txHash: error.receipt.hash,
                    status: error.receipt.status,
                    gasUsed: error.receipt.gasUsed?.toString(),
                    blockNumber: error.receipt.blockNumber,
                });
            }
            const errorText = error.message || '';
            if (errorText.includes('USDC transfer failed') || errorText.includes('ERC20: insufficient allowance')) {
                this.logger.warn('💰 User needs to approve USDC or has insufficient balance');
            }
            else if (errorText.includes('Invalid signature') || errorText.includes('Invalid user signature')) {
                this.logger.warn('🔏 Invalid user signature - possibly wrong nonce or signature mismatch');
                this.logger.warn(`   Expected nonce: ${order.nonce}`);
                this.logger.warn(`   Trader address: ${order.trader}`);
            }
            else if (errorText.includes('Trade validation failed')) {
                this.logger.warn('⚠️  RiskManager rejected the trade - check leverage/collateral limits');
            }
            else if (errorText.includes('Price in future')) {
                this.logger.warn('⏱️  Price timestamp is in the future (clock drift)');
            }
            else if (errorText.includes('execution reverted') && !error.reason) {
                this.logger.warn('❓ Transaction reverted with no reason - common causes:');
                this.logger.warn('   1. Nonce mismatch (user signature used wrong nonce)');
                this.logger.warn('   2. Insufficient USDC balance or allowance');
                this.logger.warn('   3. Invalid signature format');
                this.logger.warn('   4. RiskManager validation failed');
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
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            trackedPrices: Array.from(this.currentPrices.keys()),
            keeperAddress: this.keeperWallet.address,
            pendingOrders: this.tapToTradeService.getPendingOrders().length,
        };
    }
}
exports.TapToTradeExecutor = TapToTradeExecutor;
//# sourceMappingURL=TapToTradeExecutor.js.map