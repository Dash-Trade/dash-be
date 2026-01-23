"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneTapProfitService = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const oneTapProfit_1 = require("../types/oneTapProfit");
const OneTapProfitABI = [
    'function placeBetMeta(address trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 entryTime, bytes userSignature) external returns (uint256)',
    'function placeBetByKeeper(address trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 entryTime) external returns (uint256)',
    'function settleBet(uint256 betId, uint256 currentPrice, uint256 currentTime, bool won) external',
    'function getBet(uint256 betId) external view returns (uint256 id, address trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 entryTime, uint256 multiplier, uint8 status, uint256 settledAt, uint256 settlePrice)',
    'function getUserBets(address user) external view returns (uint256[])',
    'function getActiveBetsCount() external view returns (uint256)',
    'function calculateMultiplier(uint256 entryPrice, uint256 targetPrice, uint256 entryTime, uint256 targetTime) public pure returns (uint256)',
    'function nextBetId() external view returns (uint256)',
    'event BetPlaced(uint256 indexed betId, address indexed trader, string symbol, uint256 betAmount, uint256 targetPrice, uint256 targetTime, uint256 entryPrice, uint256 multiplier)',
    'event BetSettled(uint256 indexed betId, address indexed trader, uint8 status, uint256 payout, uint256 fee, uint256 settlePrice)',
];
class OneTapProfitService {
    constructor() {
        this.logger = new Logger_1.Logger('OneTapProfitService');
        this.bets = new Map();
        this.betsByTrader = new Map();
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.relayer = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, this.provider);
        this.contract = new ethers_1.ethers.Contract(config_1.config.ONE_TAP_PROFIT_ADDRESS, OneTapProfitABI, this.relayer);
        this.logger.success(`✅ OneTapProfitService initialized`);
        this.logger.info(`📝 Contract: ${config_1.config.ONE_TAP_PROFIT_ADDRESS}`);
        this.logger.info(`💰 Relayer: ${this.relayer.address}`);
    }
    async placeBetByKeeper(request) {
        try {
            const GRID_Y_DOLLARS = 0.05;
            const targetPriceNum = parseFloat(request.targetPrice);
            const gridBottomPrice = targetPriceNum - (GRID_Y_DOLLARS / 2);
            const gridTopPrice = targetPriceNum + (GRID_Y_DOLLARS / 2);
            const toGMT7 = (timestamp) => {
                const date = new Date(timestamp * 1000);
                date.setHours(date.getHours() + 7);
                return date.toISOString().replace('T', ' ').substring(0, 19) + ' GMT+7';
            };
            this.logger.info(`🎯 Placing One Tap Profit bet on-chain via KEEPER for ${request.trader}`);
            this.logger.info(`   Symbol: ${request.symbol}`);
            this.logger.info(`   Entry Price: $${parseFloat(request.entryPrice).toFixed(2)} at ${toGMT7(request.entryTime)}`);
            this.logger.info(`   Grid Price Range: $${gridBottomPrice.toFixed(2)} - $${gridTopPrice.toFixed(2)} (center: $${targetPriceNum.toFixed(2)})`);
            this.logger.info(`   Time Window: ${toGMT7(request.entryTime)} → ${toGMT7(request.targetTime)}`);
            const betAmountFixed = parseFloat(request.betAmount).toFixed(6);
            const targetPriceFixed = parseFloat(request.targetPrice).toFixed(8);
            const entryPriceFixed = parseFloat(request.entryPrice).toFixed(8);
            const betAmount = ethers_1.ethers.parseUnits(betAmountFixed, 6);
            const targetPrice = ethers_1.ethers.parseUnits(targetPriceFixed, 8);
            const entryPrice = ethers_1.ethers.parseUnits(entryPriceFixed, 8);
            const tx = await this.contract.placeBetByKeeper(request.trader, request.symbol, betAmount, targetPrice, request.targetTime, entryPrice, request.entryTime);
            this.logger.info(`⏳ Waiting for keeper transaction: ${tx.hash}`);
            const receipt = await tx.wait();
            const event = receipt.logs.find((log) => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed?.name === 'BetPlaced';
                }
                catch {
                    return false;
                }
            });
            const parsedEvent = this.contract.interface.parseLog(event);
            const onChainBetId = parsedEvent?.args?.betId?.toString();
            const multiplierResult = await this.calculateMultiplier({
                entryPrice: request.entryPrice,
                targetPrice: request.targetPrice,
                entryTime: request.entryTime,
                targetTime: request.targetTime,
            });
            const bet = {
                betId: onChainBetId,
                trader: request.trader.toLowerCase(),
                symbol: request.symbol,
                betAmount: request.betAmount,
                targetPrice: request.targetPrice,
                targetTime: request.targetTime,
                entryPrice: request.entryPrice,
                entryTime: request.entryTime,
                multiplier: multiplierResult.multiplier,
                status: oneTapProfit_1.OneTapBetStatus.ACTIVE,
                createdAt: Date.now(),
            };
            this.bets.set(onChainBetId, bet);
            const traderBets = this.betsByTrader.get(bet.trader) || [];
            traderBets.push(onChainBetId);
            this.betsByTrader.set(bet.trader, traderBets);
            this.logger.success(`✅ Bet placed on-chain via KEEPER! BetId: ${onChainBetId}, TxHash: ${tx.hash}`);
            return { betId: onChainBetId, txHash: tx.hash };
        }
        catch (error) {
            this.logger.error('Failed to place bet via keeper:', error);
            throw new Error(`Failed to place bet: ${error.message}`);
        }
    }
    async placeBet(request) {
        try {
            const GRID_Y_DOLLARS = 0.05;
            const targetPriceNum = parseFloat(request.targetPrice);
            const gridBottomPrice = targetPriceNum - (GRID_Y_DOLLARS / 2);
            const gridTopPrice = targetPriceNum + (GRID_Y_DOLLARS / 2);
            const toGMT7 = (timestamp) => {
                const date = new Date(timestamp * 1000);
                date.setHours(date.getHours() + 7);
                return date.toISOString().replace('T', ' ').substring(0, 19) + ' GMT+7';
            };
            this.logger.info(`🎯 Placing One Tap Profit bet on-chain for ${request.trader}`);
            this.logger.info(`   Symbol: ${request.symbol}`);
            this.logger.info(`   Entry Price: $${parseFloat(request.entryPrice).toFixed(2)} at ${toGMT7(request.entryTime)}`);
            this.logger.info(`   Grid Price Range: $${gridBottomPrice.toFixed(2)} - $${gridTopPrice.toFixed(2)} (center: $${targetPriceNum.toFixed(2)})`);
            this.logger.info(`   Time Window: ${toGMT7(request.entryTime)} → ${toGMT7(request.targetTime)}`);
            const betAmountFixed = parseFloat(request.betAmount).toFixed(6);
            const targetPriceFixed = parseFloat(request.targetPrice).toFixed(8);
            const entryPriceFixed = parseFloat(request.entryPrice).toFixed(8);
            const betAmount = ethers_1.ethers.parseUnits(betAmountFixed, 6);
            const targetPrice = ethers_1.ethers.parseUnits(targetPriceFixed, 8);
            const entryPrice = ethers_1.ethers.parseUnits(entryPriceFixed, 8);
            const tx = await this.contract.placeBetMeta(request.trader, request.symbol, betAmount, targetPrice, request.targetTime, entryPrice, request.entryTime, request.userSignature);
            this.logger.info(`⏳ Waiting for transaction: ${tx.hash}`);
            const receipt = await tx.wait();
            const event = receipt.logs.find((log) => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed?.name === 'BetPlaced';
                }
                catch {
                    return false;
                }
            });
            const parsedEvent = this.contract.interface.parseLog(event);
            const onChainBetId = parsedEvent?.args?.betId?.toString();
            const multiplierResult = await this.calculateMultiplier({
                entryPrice: request.entryPrice,
                targetPrice: request.targetPrice,
                entryTime: request.entryTime,
                targetTime: request.targetTime,
            });
            const bet = {
                betId: onChainBetId,
                trader: request.trader.toLowerCase(),
                symbol: request.symbol,
                betAmount: request.betAmount,
                targetPrice: request.targetPrice,
                targetTime: request.targetTime,
                entryPrice: request.entryPrice,
                entryTime: request.entryTime,
                multiplier: multiplierResult.multiplier,
                status: oneTapProfit_1.OneTapBetStatus.ACTIVE,
                createdAt: Date.now(),
            };
            this.bets.set(onChainBetId, bet);
            const traderBets = this.betsByTrader.get(bet.trader) || [];
            traderBets.push(onChainBetId);
            this.betsByTrader.set(bet.trader, traderBets);
            this.logger.success(`✅ Bet placed on-chain! BetId: ${onChainBetId}, TxHash: ${tx.hash}`);
            return { betId: onChainBetId, txHash: tx.hash };
        }
        catch (error) {
            this.logger.error('Failed to place bet:', error);
            throw new Error(`Failed to place bet: ${error.message}`);
        }
    }
    async syncBetFromChain(betId) {
        try {
            const betData = await this.contract.getBet(betId);
            const bet = {
                betId: betData.id.toString(),
                trader: betData.trader.toLowerCase(),
                symbol: betData.symbol,
                betAmount: ethers_1.ethers.formatUnits(betData.betAmount, 6),
                targetPrice: ethers_1.ethers.formatUnits(betData.targetPrice, 8),
                targetTime: Number(betData.targetTime),
                entryPrice: ethers_1.ethers.formatUnits(betData.entryPrice, 8),
                entryTime: Number(betData.entryTime),
                multiplier: Number(betData.multiplier),
                status: this.mapStatus(Number(betData.status)),
                settledAt: betData.settledAt > 0 ? Number(betData.settledAt) : undefined,
                settlePrice: betData.settlePrice > 0 ? ethers_1.ethers.formatUnits(betData.settlePrice, 8) : undefined,
                createdAt: Date.now(),
            };
            this.bets.set(betId, bet);
            const traderBets = this.betsByTrader.get(bet.trader) || [];
            if (!traderBets.includes(betId)) {
                traderBets.push(betId);
                this.betsByTrader.set(bet.trader, traderBets);
            }
            return bet;
        }
        catch (error) {
            this.logger.error(`Failed to sync bet ${betId}:`, error);
            throw error;
        }
    }
    async getBet(betId) {
        const cachedBet = this.bets.get(betId);
        if (cachedBet) {
            return cachedBet;
        }
        try {
            return await this.syncBetFromChain(betId);
        }
        catch (error) {
            this.logger.error(`Failed to get bet ${betId}:`, error);
            return null;
        }
    }
    async queryBets(query) {
        let bets = Array.from(this.bets.values());
        if (query.trader) {
            const trader = query.trader.toLowerCase();
            const betIds = this.betsByTrader.get(trader) || [];
            bets = bets.filter(b => betIds.includes(b.betId));
        }
        if (query.symbol) {
            bets = bets.filter(b => b.symbol === query.symbol);
        }
        if (query.status) {
            bets = bets.filter(b => b.status === query.status);
        }
        return bets.sort((a, b) => b.createdAt - a.createdAt);
    }
    getActiveBets() {
        return Array.from(this.bets.values())
            .filter(b => b.status === oneTapProfit_1.OneTapBetStatus.ACTIVE)
            .sort((a, b) => a.targetTime - b.targetTime);
    }
    async calculateMultiplier(request) {
        try {
            const entryPriceFixed = parseFloat(request.entryPrice).toFixed(8);
            const targetPriceFixed = parseFloat(request.targetPrice).toFixed(8);
            const entryPrice = ethers_1.ethers.parseUnits(entryPriceFixed, 8);
            const targetPrice = ethers_1.ethers.parseUnits(targetPriceFixed, 8);
            const multiplier = await this.contract.calculateMultiplier(entryPrice, targetPrice, request.entryTime, request.targetTime);
            const entryNum = parseFloat(request.entryPrice);
            const targetNum = parseFloat(request.targetPrice);
            const priceDistance = ((Math.abs(targetNum - entryNum) / entryNum) * 100).toFixed(2);
            const timeDistance = request.targetTime - request.entryTime;
            return {
                multiplier: Number(multiplier),
                priceDistance: `${priceDistance}%`,
                timeDistance,
            };
        }
        catch (error) {
            this.logger.error('Failed to calculate multiplier:', error);
            throw new Error(`Failed to calculate multiplier: ${error.message}`);
        }
    }
    getStats() {
        const bets = Array.from(this.bets.values());
        return {
            totalBets: bets.length,
            activeBets: bets.filter(b => b.status === oneTapProfit_1.OneTapBetStatus.ACTIVE).length,
            wonBets: bets.filter(b => b.status === oneTapProfit_1.OneTapBetStatus.WON).length,
            lostBets: bets.filter(b => b.status === oneTapProfit_1.OneTapBetStatus.LOST).length,
            totalVolume: bets.reduce((sum, b) => sum + parseFloat(b.betAmount), 0).toFixed(6),
            totalPayout: '0',
        };
    }
    getContractAddress() {
        return this.contract.target;
    }
    async settleBet(betId, currentPrice, currentTime, won) {
        try {
            const bet = this.bets.get(betId);
            if (!bet) {
                throw new Error('Bet not found in memory');
            }
            this.logger.info(`🔄 Settling bet ${betId}... (${won ? 'WON' : 'LOST'})`);
            const currentPriceFixed = parseFloat(currentPrice).toFixed(8);
            const priceInUnits = ethers_1.ethers.parseUnits(currentPriceFixed, 8);
            const tx = await this.contract.settleBet(betId, priceInUnits, currentTime, won);
            this.logger.info(`⏳ Waiting for settlement: ${tx.hash}`);
            await tx.wait();
            this.logger.success(`✅ Bet ${betId} settled! TxHash: ${tx.hash}`);
            bet.status = won ? oneTapProfit_1.OneTapBetStatus.WON : oneTapProfit_1.OneTapBetStatus.LOST;
            bet.settleTxHash = tx.hash;
        }
        catch (error) {
            this.logger.error(`Failed to settle bet ${betId}:`, error);
            throw error;
        }
    }
    mapStatus(status) {
        switch (status) {
            case 0: return oneTapProfit_1.OneTapBetStatus.ACTIVE;
            case 1: return oneTapProfit_1.OneTapBetStatus.WON;
            case 2: return oneTapProfit_1.OneTapBetStatus.LOST;
            case 3: return oneTapProfit_1.OneTapBetStatus.CANCELLED;
            default: return oneTapProfit_1.OneTapBetStatus.ACTIVE;
        }
    }
}
exports.OneTapProfitService = OneTapProfitService;
//# sourceMappingURL=OneTapProfitService.js.map