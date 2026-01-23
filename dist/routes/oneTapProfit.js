"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOneTapProfitRoute = createOneTapProfitRoute;
const express_1 = require("express");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger('OneTapProfitRoutes');
function createOneTapProfitRoute(oneTapService, oneTapMonitor) {
    const router = (0, express_1.Router)();
    router.post('/place-bet', async (req, res) => {
        try {
            const params = req.body;
            if (!params.trader || !params.symbol || !params.betAmount || !params.targetPrice) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: trader, symbol, betAmount, targetPrice, targetTime, entryPrice, entryTime, nonce, userSignature',
                });
            }
            const result = await oneTapService.placeBet(params);
            res.json({
                success: true,
                data: result,
                message: 'Bet placed successfully (gasless transaction)',
            });
        }
        catch (error) {
            logger.error('Error placing bet:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to place bet',
            });
        }
    });
    router.post('/place-bet-with-session', async (req, res) => {
        try {
            const { trader, symbol, betAmount, targetPrice, targetTime, entryPrice, entryTime, sessionSignature } = req.body;
            if (!trader || !symbol || !betAmount || !targetPrice || !sessionSignature) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: trader, symbol, betAmount, targetPrice, targetTime, entryPrice, entryTime, sessionSignature',
                });
            }
            logger.info(`🎯 Placing OneTapProfit bet via keeper for trader ${trader}`);
            logger.info(`   Session signature provided, executing gaslessly...`);
            const result = await oneTapService.placeBetByKeeper({
                trader,
                symbol,
                betAmount,
                targetPrice,
                targetTime,
                entryPrice,
                entryTime,
            });
            res.json({
                success: true,
                data: result,
                message: 'Bet placed successfully via keeper (fully gasless!)',
            });
        }
        catch (error) {
            logger.error('Error placing bet with session:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to place bet',
            });
        }
    });
    router.get('/bet/:betId', async (req, res) => {
        try {
            const { betId } = req.params;
            const bet = await oneTapService.getBet(betId);
            if (!bet) {
                return res.status(404).json({
                    success: false,
                    error: 'Bet not found',
                });
            }
            res.json({
                success: true,
                data: bet,
            });
        }
        catch (error) {
            logger.error('Error fetching bet:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch bet',
            });
        }
    });
    router.get('/bets', async (req, res) => {
        try {
            const { trader, symbol, status } = req.query;
            const bets = await oneTapService.queryBets({
                trader: trader,
                symbol: symbol,
                status: status,
            });
            res.json({
                success: true,
                data: bets,
                count: bets.length,
            });
        }
        catch (error) {
            logger.error('Error querying bets:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to query bets',
            });
        }
    });
    router.get('/active', (req, res) => {
        try {
            const bets = oneTapService.getActiveBets();
            res.json({
                success: true,
                data: bets,
                count: bets.length,
            });
        }
        catch (error) {
            logger.error('Error fetching active bets:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch active bets',
            });
        }
    });
    router.post('/calculate-multiplier', async (req, res) => {
        try {
            const params = req.body;
            if (!params.entryPrice || !params.targetPrice || !params.entryTime || !params.targetTime) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: entryPrice, targetPrice, entryTime, targetTime',
                });
            }
            const result = await oneTapService.calculateMultiplier(params);
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            logger.error('Error calculating multiplier:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to calculate multiplier',
            });
        }
    });
    router.get('/stats', (req, res) => {
        try {
            const stats = oneTapService.getStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            logger.error('Error fetching stats:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch stats',
            });
        }
    });
    router.get('/status', (req, res) => {
        try {
            const status = oneTapMonitor.getStatus();
            const contractAddress = oneTapService.getContractAddress();
            res.json({
                success: true,
                data: {
                    ...status,
                    contractAddress,
                },
            });
        }
        catch (error) {
            logger.error('Error fetching status:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch status',
            });
        }
    });
    return router;
}
//# sourceMappingURL=oneTapProfit.js.map