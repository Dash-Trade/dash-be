"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTapToTradeRoute = createTapToTradeRoute;
const express_1 = require("express");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger('TapToTradeRoutes');
function createTapToTradeRoute(tapToTradeService) {
    const router = (0, express_1.Router)();
    router.post('/create-order', async (req, res) => {
        try {
            const params = req.body;
            if (!params.trader || !params.symbol || !params.collateral) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: trader, symbol, collateral',
                });
            }
            const order = tapToTradeService.createOrder(params);
            res.json({
                success: true,
                data: order,
                message: 'Tap-to-trade order created successfully (backend-only)',
            });
        }
        catch (error) {
            logger.error('Error creating tap-to-trade order:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to create tap-to-trade order',
            });
        }
    });
    router.post('/batch-create', async (req, res) => {
        try {
            const params = req.body;
            if (!params.gridSessionId || !params.orders || params.orders.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: gridSessionId, orders',
                });
            }
            const createdOrders = tapToTradeService.batchCreateOrders(params.orders);
            logger.info(`✅ Created ${createdOrders.length} tap-to-trade orders for grid ${params.gridSessionId}`);
            res.json({
                success: true,
                data: {
                    gridSessionId: params.gridSessionId,
                    ordersCreated: createdOrders.length,
                    orders: createdOrders,
                },
                message: `${createdOrders.length} tap-to-trade orders created successfully (backend-only)`,
            });
        }
        catch (error) {
            logger.error('Error batch creating tap-to-trade orders:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to batch create tap-to-trade orders',
            });
        }
    });
    router.get('/order/:orderId', (req, res) => {
        try {
            const { orderId } = req.params;
            const order = tapToTradeService.getOrder(orderId);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found',
                });
            }
            res.json({
                success: true,
                data: order,
            });
        }
        catch (error) {
            logger.error('Error fetching tap-to-trade order:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch order',
            });
        }
    });
    router.get('/orders', (req, res) => {
        try {
            const { trader, gridSessionId, cellId, status } = req.query;
            const orders = tapToTradeService.queryOrders({
                trader: trader,
                gridSessionId: gridSessionId,
                cellId: cellId,
                status: status,
            });
            res.json({
                success: true,
                data: orders,
                count: orders.length,
            });
        }
        catch (error) {
            logger.error('Error querying tap-to-trade orders:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to query orders',
            });
        }
    });
    router.get('/pending', (req, res) => {
        try {
            const orders = tapToTradeService.getPendingOrders();
            res.json({
                success: true,
                data: orders,
                count: orders.length,
            });
        }
        catch (error) {
            logger.error('Error fetching pending orders:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch pending orders',
            });
        }
    });
    router.get('/cell/:cellId', (req, res) => {
        try {
            const { cellId } = req.params;
            const orders = tapToTradeService.getOrdersByCell(cellId);
            res.json({
                success: true,
                data: orders,
                count: orders.length,
            });
        }
        catch (error) {
            logger.error('Error fetching orders by cell:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to fetch orders',
            });
        }
    });
    router.post('/cancel-order', (req, res) => {
        try {
            const { orderId, trader } = req.body;
            if (!orderId || !trader) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: orderId, trader',
                });
            }
            tapToTradeService.cancelOrder(orderId, trader);
            res.json({
                success: true,
                message: 'Tap-to-trade order cancelled successfully (no gas fee)',
            });
        }
        catch (error) {
            logger.error('Error cancelling tap-to-trade order:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to cancel order',
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
            const cancelledCount = tapToTradeService.cancelOrdersByCell(cellId, trader);
            res.json({
                success: true,
                data: { cancelledCount },
                message: `${cancelledCount} tap-to-trade orders cancelled successfully (no gas fee)`,
            });
        }
        catch (error) {
            logger.error('Error cancelling cell orders:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to cancel cell orders',
            });
        }
    });
    router.post('/cancel-grid', (req, res) => {
        try {
            const { gridSessionId, trader } = req.body;
            if (!gridSessionId || !trader) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: gridSessionId, trader',
                });
            }
            const cancelledCount = tapToTradeService.cancelOrdersByGrid(gridSessionId, trader);
            res.json({
                success: true,
                data: { cancelledCount },
                message: `${cancelledCount} tap-to-trade orders cancelled successfully (no gas fee)`,
            });
        }
        catch (error) {
            logger.error('Error cancelling grid orders:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to cancel grid orders',
            });
        }
    });
    router.post('/update-signature', (req, res) => {
        try {
            const { orderId, nonce, signature, trader } = req.body;
            if (!orderId || !nonce || !signature || !trader) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields: orderId, nonce, signature, trader',
                });
            }
            tapToTradeService.updateSignature(orderId, nonce, signature, trader);
            res.json({
                success: true,
                message: 'Order signature updated successfully',
            });
        }
        catch (error) {
            logger.error('Error updating signature:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to update signature',
            });
        }
    });
    router.get('/stats', (req, res) => {
        try {
            const stats = tapToTradeService.getStats();
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
    return router;
}
//# sourceMappingURL=tapToTrade.js.map