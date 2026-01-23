"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGridTradingRoute = createGridTradingRoute;
const express_1 = require("express");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger('GridTradingRoutes');
function createGridTradingRoute(gridService) {
    const router = (0, express_1.Router)();
    router.post('/create-session', async (req, res) => {
        try {
            const params = req.body;
            if (!params.trader || !params.symbol || !params.marginTotal) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: trader, symbol, marginTotal',
                });
            }
            const session = gridService.createGridSession(params);
            res.json({
                success: true,
                data: session,
                message: 'Grid session created successfully',
            });
        }
        catch (error) {
            logger.error('Error creating grid session:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create grid session',
            });
        }
    });
    router.post('/place-orders', async (_req, res) => {
        res.status(410).json({
            success: false,
            error: 'This endpoint is deprecated for Tap-to-Trade',
            message: 'Please use POST /api/tap-to-trade/batch-create instead',
            recommendation: {
                endpoint: '/api/tap-to-trade/batch-create',
                benefit: 'Backend-only storage, no gas fee for order creation',
            },
        });
    });
    router.get('/session/:gridId', (req, res) => {
        try {
            const { gridId } = req.params;
            const sessionData = gridService.getGridSessionWithCells(gridId);
            if (!sessionData) {
                return res.status(404).json({
                    success: false,
                    error: 'Grid session not found',
                });
            }
            res.json({
                success: true,
                data: sessionData,
            });
        }
        catch (error) {
            logger.error('Error fetching grid session:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch grid session',
            });
        }
    });
    router.get('/user/:trader', (req, res) => {
        try {
            const { trader } = req.params;
            const sessions = gridService.getUserGrids(trader);
            res.json({
                success: true,
                data: sessions,
                count: sessions.length,
            });
        }
        catch (error) {
            logger.error('Error fetching user grids:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch user grids',
            });
        }
    });
    router.post('/cancel-session', (req, res) => {
        try {
            const { gridId, trader } = req.body;
            if (!gridId || !trader) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: gridId, trader',
                });
            }
            gridService.cancelGridSession(gridId, trader);
            res.json({
                success: true,
                message: 'Grid session cancelled successfully',
            });
        }
        catch (error) {
            logger.error('Error cancelling grid session:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to cancel grid session',
            });
        }
    });
    router.post('/cancel-cell', (req, res) => {
        try {
            const { cellId, trader } = req.body;
            if (!cellId || !trader) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: cellId, trader',
                });
            }
            gridService.cancelGridCell(cellId, trader);
            res.json({
                success: true,
                message: 'Grid cell cancelled successfully',
            });
        }
        catch (error) {
            logger.error('Error cancelling grid cell:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to cancel grid cell',
            });
        }
    });
    router.get('/stats', (_req, res) => {
        try {
            const stats = gridService.getStats();
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            logger.error('Error fetching grid stats:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch grid stats',
            });
        }
    });
    router.get('/active-cells', (_req, res) => {
        try {
            const cells = gridService.getActiveCells();
            res.json({
                success: true,
                data: cells,
                count: cells.length,
            });
        }
        catch (error) {
            logger.error('Error fetching active cells:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch active cells',
            });
        }
    });
    return router;
}
//# sourceMappingURL=gridTrading.js.map