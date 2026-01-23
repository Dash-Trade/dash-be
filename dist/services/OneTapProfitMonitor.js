"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneTapProfitMonitor = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const OneTapProfitABI = [
    'function settleBet(uint256 betId, uint256 currentPrice, uint256 currentTime, bool won) external',
];
class OneTapProfitMonitor {
    constructor(priceService, oneTapService) {
        this.logger = new Logger_1.Logger('OneTapProfitMonitor');
        this.isRunning = false;
        this.priceHistory = new Map();
        this.previousPrices = new Map();
        this.isSettling = false;
        this.settlementQueue = [];
        this.queuedBets = new Set();
        this.priceService = priceService;
        this.oneTapService = oneTapService;
        const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.relayer = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, provider);
        this.contract = new ethers_1.ethers.Contract(config_1.config.ONE_TAP_PROFIT_ADDRESS, OneTapProfitABI, this.relayer);
        this.logger.info('🎯 OneTapProfitMonitor initialized');
    }
    start() {
        if (this.isRunning) {
            this.logger.warn('Monitor already running');
            return;
        }
        this.isRunning = true;
        this.logger.success('✅ OneTapProfitMonitor started! Checking bets every second...');
        this.intervalId = setInterval(() => {
            this.checkBets().catch((error) => {
                this.logger.error('Error checking bets:', error);
            });
        }, 1000);
    }
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.logger.info('OneTapProfitMonitor stopped');
    }
    async checkBets() {
        try {
            const activeBets = this.oneTapService.getActiveBets();
            if (activeBets.length === 0) {
                return;
            }
            const now = Math.floor(Date.now() / 1000);
            const prices = this.priceService.getCurrentPrices();
            for (const bet of activeBets) {
                try {
                    const priceData = prices[bet.symbol];
                    if (!priceData) {
                        continue;
                    }
                    const currentPrice = priceData.price;
                    const targetPriceNum = parseFloat(bet.targetPrice);
                    const entryPriceNum = parseFloat(bet.entryPrice);
                    const toGMT7 = (timestamp) => {
                        const date = new Date(timestamp * 1000);
                        date.setHours(date.getHours() + 7);
                        return date.toISOString().replace('T', ' ').substring(11, 19);
                    };
                    let previousPrice = this.previousPrices.get(bet.symbol);
                    const history = this.priceHistory.get(bet.betId) || [];
                    if (history.length === 0) {
                        previousPrice = entryPriceNum;
                    }
                    history.push({ price: currentPrice, timestamp: now });
                    const recentHistory = history.filter(h => now - h.timestamp <= 60);
                    this.priceHistory.set(bet.betId, recentHistory);
                    let shouldSettle = false;
                    let won = false;
                    const GRID_Y_DOLLARS = bet.symbol === 'SOL' ? 0.05 : 10;
                    const gridHalfSize = GRID_Y_DOLLARS / 2;
                    const gridMin = targetPriceNum - gridHalfSize;
                    const gridMax = targetPriceNum + gridHalfSize;
                    const priceInRange = currentPrice >= gridMin && currentPrice <= gridMax;
                    const inTimeWindow = now >= bet.entryTime && now <= bet.targetTime;
                    if (priceInRange && inTimeWindow) {
                        shouldSettle = true;
                        won = true;
                    }
                    else if (now > bet.targetTime) {
                        shouldSettle = true;
                        won = false;
                    }
                    if (shouldSettle && !this.queuedBets.has(bet.betId)) {
                        if (won) {
                            this.logger.success(`🎉 Bet ${bet.betId} WON!`);
                            this.logger.success(`   Price: $${currentPrice.toFixed(2)} in range [$${gridMin.toFixed(2)} - $${gridMax.toFixed(2)}]`);
                            this.logger.success(`   Time: ${toGMT7(now)} (valid until ${toGMT7(bet.targetTime)})`);
                        }
                        else {
                            this.logger.info(`⏰ Bet ${bet.betId} LOST! Time expired`);
                            this.logger.info(`   Final Price: $${currentPrice.toFixed(2)} (needed range: $${gridMin.toFixed(2)} - $${gridMax.toFixed(2)})`);
                            this.logger.info(`   Expired at: ${toGMT7(now)} (limit was ${toGMT7(bet.targetTime)})`);
                        }
                        this.queuedBets.add(bet.betId);
                        this.settlementQueue.push({
                            betId: bet.betId,
                            currentPrice: currentPrice.toString(),
                            currentTime: now,
                            won,
                        });
                    }
                }
                catch (error) {
                    this.logger.error(`Error checking bet ${bet.betId}:`, error);
                }
            }
            for (const [symbol, priceData] of Object.entries(prices)) {
                if (priceData && priceData.price) {
                    this.previousPrices.set(symbol, priceData.price);
                }
            }
            await this.processSettlementQueue();
        }
        catch (error) {
            this.logger.error('Error in checkBets:', error);
        }
    }
    async processSettlementQueue() {
        if (this.isSettling || this.settlementQueue.length === 0) {
            return;
        }
        this.isSettling = true;
        try {
            while (this.settlementQueue.length > 0) {
                const settlement = this.settlementQueue.shift();
                if (!settlement)
                    break;
                try {
                    await this.settleBet(settlement.betId, settlement.currentPrice, settlement.currentTime, settlement.won);
                    this.priceHistory.delete(settlement.betId);
                    this.queuedBets.delete(settlement.betId);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                catch (error) {
                    this.logger.error(`Failed to settle bet ${settlement.betId}:`, error);
                    this.logger.warn(`Bet ${settlement.betId} remains ACTIVE - please fix settler role and restart`);
                }
            }
        }
        finally {
            this.isSettling = false;
        }
    }
    async settleBet(betId, currentPrice, currentTime, won) {
        try {
            await this.oneTapService.settleBet(betId, currentPrice, currentTime, won);
        }
        catch (error) {
            this.logger.error(`Failed to settle bet ${betId}:`, error);
            throw error;
        }
    }
    hasPriceCrossedTarget(previousPrice, currentPrice, targetPrice, entryPrice) {
        const isUpBet = targetPrice > entryPrice;
        if (isUpBet) {
            return previousPrice < targetPrice && currentPrice >= targetPrice;
        }
        else {
            return previousPrice > targetPrice && currentPrice <= targetPrice;
        }
    }
    checkTargetReached(currentPrice, targetPrice, entryPrice) {
        const threshold = targetPrice * 0.0001;
        const isUpBet = targetPrice > entryPrice;
        if (isUpBet) {
            return currentPrice >= targetPrice - threshold;
        }
        else {
            return currentPrice <= targetPrice + threshold;
        }
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeBets: this.oneTapService.getActiveBets().length,
            monitoredPrices: this.priceHistory.size,
        };
    }
}
exports.OneTapProfitMonitor = OneTapProfitMonitor;
//# sourceMappingURL=OneTapProfitMonitor.js.map