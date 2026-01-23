"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLimitOrderRoute = createLimitOrderRoute;
const express_1 = require("express");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger('LimitOrderRoute');
function createLimitOrderRoute(limitOrderService) {
    const router = (0, express_1.Router)();
    router.post('/create', async (req, res) => {
        const { trader, symbol, isLong, collateral, leverage, triggerPrice, nonce, expiresAt, signature, takeProfit, stopLoss, metadata, } = req.body ?? {};
        if (!trader || typeof trader !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid trader address',
                timestamp: Date.now(),
            });
        }
        if (!symbol || typeof symbol !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid symbol',
                timestamp: Date.now(),
            });
        }
        if (typeof isLong !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Invalid isLong flag',
                timestamp: Date.now(),
            });
        }
        const numericFields = {
            collateral,
            leverage,
            triggerPrice,
            nonce,
            expiresAt,
        };
        for (const [key, value] of Object.entries(numericFields)) {
            if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
                return res.status(400).json({
                    success: false,
                    error: `Invalid ${key} value`,
                    timestamp: Date.now(),
                });
            }
        }
        if (!signature || typeof signature !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid signature',
                timestamp: Date.now(),
            });
        }
        const payload = {
            trader,
            symbol,
            isLong,
            collateral: String(collateral),
            leverage: String(leverage),
            triggerPrice: String(triggerPrice),
            nonce: String(nonce),
            expiresAt: String(expiresAt),
            signature,
            takeProfit: takeProfit ? String(takeProfit) : undefined,
            stopLoss: stopLoss ? String(stopLoss) : undefined,
            metadata,
        };
        try {
            const result = await limitOrderService.createLimitOpenOrder(payload);
            const explorerUrl = `https://sepolia.basescan.org/tx/${result.txHash}`;
            res.json({
                success: true,
                data: {
                    ...result,
                    explorerUrl,
                },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            logger.error('Failed to create limit order', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create limit order',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
            });
        }
    });
    return router;
}
//# sourceMappingURL=limitOrders.js.map