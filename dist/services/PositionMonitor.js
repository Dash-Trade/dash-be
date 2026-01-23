"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionMonitor = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const PositionManager_json_1 = __importDefault(require("../abis/PositionManager.json"));
const MarketExecutor_json_1 = __importDefault(require("../abis/MarketExecutor.json"));
const RiskManager_json_1 = __importDefault(require("../abis/RiskManager.json"));
class PositionMonitor {
    constructor(pythPriceService) {
        this.isRunning = false;
        this.checkInterval = 1000;
        this.currentPrices = new Map();
        this.logger = new Logger_1.Logger('PositionMonitor');
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.keeperWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, this.provider);
        this.priceSignerWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY);
        this.positionManager = new ethers_1.Contract(config_1.config.POSITION_MANAGER_ADDRESS, PositionManager_json_1.default.abi, this.keeperWallet);
        this.marketExecutor = new ethers_1.Contract(config_1.config.MARKET_EXECUTOR_ADDRESS, MarketExecutor_json_1.default.abi, this.keeperWallet);
        this.riskManager = new ethers_1.Contract(config_1.config.RISK_MANAGER_ADDRESS, RiskManager_json_1.default.abi, this.provider);
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
        this.logger.info('🔍 Position Monitor initialized');
        this.logger.info(`   Keeper: ${this.keeperWallet.address}`);
        this.logger.info(`   Position Manager: ${positionManagerAddress}`);
        this.logger.info(`   Market Executor: ${marketExecutorAddress}`);
        this.logger.info(`   Risk Manager: ${riskManagerAddress}`);
    }
    start() {
        if (this.isRunning) {
            this.logger.warn('⚠️  Monitor already running');
            return;
        }
        this.isRunning = true;
        this.logger.info('▶️  Starting position monitor...');
        this.monitorLoop();
    }
    stop() {
        this.isRunning = false;
        this.logger.info('⏹️  Stopping position monitor...');
    }
    async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkAllPositions();
            }
            catch (error) {
                this.logger.error('Error in monitor loop:', error);
            }
            await this.sleep(this.checkInterval);
        }
    }
    async checkAllPositions() {
        try {
            const nextPositionId = await this.positionManager.nextPositionId();
            const totalPositions = Number(nextPositionId) - 1;
            if (totalPositions === 0) {
                return;
            }
            const startId = Math.max(1, totalPositions - 99);
            for (let positionId = startId; positionId <= totalPositions; positionId++) {
                try {
                    const position = await this.getPosition(positionId);
                    if (!position || position.status !== 0) {
                        continue;
                    }
                    await this.checkPositionLiquidation(position);
                }
                catch (error) {
                    if (!error.message?.includes('Position not found')) {
                        this.logger.error(`Error checking position ${positionId}:`, error);
                    }
                }
            }
        }
        catch (error) {
            this.logger.error('Error checking all positions:', error);
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
                status: positionData.status,
            };
        }
        catch (error) {
            return null;
        }
    }
    async checkPositionLiquidation(position) {
        try {
            const priceData = this.currentPrices.get(position.symbol);
            if (!priceData) {
                return;
            }
            if (Date.now() - priceData.timestamp > 60000) {
                this.logger.warn(`⏰ Stale price for ${position.symbol}`);
                return;
            }
            const currentPrice = priceData.price;
            const shouldLiquidate = await this.riskManager.shouldLiquidate(position.id, currentPrice, position.collateral, position.size, position.entryPrice, position.isLong);
            if (shouldLiquidate) {
                this.logger.warn(`⚠️  Position ${position.id} should be liquidated!`);
                this.logger.info(`   Trader: ${position.trader}`);
                this.logger.info(`   Symbol: ${position.symbol}`);
                this.logger.info(`   Entry: ${this.formatPrice(position.entryPrice)}`);
                this.logger.info(`   Current: ${this.formatPrice(currentPrice)}`);
                this.logger.info(`   Collateral: ${this.formatUsdc(position.collateral)}`);
                await this.liquidatePosition(position, currentPrice);
            }
        }
        catch (error) {
            this.logger.error(`Error checking liquidation for position ${position.id}:`, error);
        }
    }
    async liquidatePosition(position, currentPrice) {
        try {
            this.logger.info(`🔨 Liquidating position ${position.id}...`);
            const timestamp = Math.floor(Date.now() / 1000) - 60;
            const signedPrice = await this.signPrice(position.symbol, currentPrice, timestamp);
            this.logger.info('Price signature details:', {
                symbol: signedPrice.symbol,
                price: this.formatPrice(signedPrice.price),
                timestamp: signedPrice.timestamp,
                signature: signedPrice.signature.substring(0, 20) + '...',
            });
            const tx = await this.marketExecutor.liquidatePosition(position.id, signedPrice, { gasLimit: 500000 });
            this.logger.info(`📤 Liquidation tx sent: ${tx.hash}`);
            const receipt = await tx.wait();
            this.logger.success(`✅ Position ${position.id} liquidated successfully!`);
            this.logger.info(`   TX: ${receipt.hash}`);
            this.logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to liquidate position ${position.id}:`, error.message);
            if (error.message?.includes('Position not eligible for liquidation')) {
                this.logger.warn('💡 Position no longer eligible for liquidation (price recovered?)');
            }
            else if (error.message?.includes('Position not open')) {
                this.logger.warn('💡 Position already closed');
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
exports.PositionMonitor = PositionMonitor;
//# sourceMappingURL=PositionMonitor.js.map