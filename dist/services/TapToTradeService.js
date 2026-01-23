"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TapToTradeService = void 0;
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const tapToTrade_1 = require("../types/tapToTrade");
const SessionKeyValidator_1 = require("./SessionKeyValidator");
class TapToTradeService {
    constructor() {
        this.logger = new Logger_1.Logger('TapToTradeService');
        this.orders = new Map();
        this.ordersByTrader = new Map();
        this.ordersByGrid = new Map();
        this.ordersByCell = new Map();
        this.sessionValidator = new SessionKeyValidator_1.SessionKeyValidator();
        this.logger.info('🎯 TapToTradeService initialized (in-memory storage)');
        this.logger.warn('⚠️  Data will be lost on server restart');
    }
    createOrder(params) {
        const marketExecutor = config_1.config.TAP_TO_TRADE_EXECUTOR_ADDRESS;
        if (params.sessionKey) {
            const validation = this.sessionValidator.validateOrderWithSession({
                trader: params.trader,
                symbol: params.symbol,
                isLong: params.isLong,
                collateral: params.collateral,
                leverage: params.leverage,
                nonce: params.nonce,
                signature: params.signature,
                marketExecutor,
                sessionKey: params.sessionKey,
            });
            if (!validation.valid) {
                this.logger.error('❌ Session validation failed:', validation.error);
                throw new Error(`Invalid session signature: ${validation.error}`);
            }
            this.logger.info('✅ Order validated with session key');
        }
        else {
            const validation = this.sessionValidator.validateOrderWithoutSession({
                trader: params.trader,
                symbol: params.symbol,
                isLong: params.isLong,
                collateral: params.collateral,
                leverage: params.leverage,
                nonce: params.nonce,
                signature: params.signature,
                marketExecutor,
            });
            if (!validation.valid) {
                this.logger.error('❌ Signature validation failed:', validation.error);
                throw new Error(`Invalid signature: ${validation.error}`);
            }
            this.logger.info('✅ Order validated with traditional signature');
        }
        const id = this.generateId('ttt');
        const order = {
            id,
            gridSessionId: params.gridSessionId,
            cellId: params.cellId,
            trader: params.trader.toLowerCase(),
            symbol: params.symbol,
            isLong: params.isLong,
            collateral: params.collateral,
            leverage: params.leverage,
            triggerPrice: params.triggerPrice,
            startTime: params.startTime,
            endTime: params.endTime,
            nonce: params.nonce,
            signature: params.signature,
            sessionKey: params.sessionKey,
            status: tapToTrade_1.TapToTradeOrderStatus.PENDING,
            createdAt: Date.now(),
        };
        this.orders.set(id, order);
        const trader = order.trader;
        const traderOrders = this.ordersByTrader.get(trader) || [];
        traderOrders.push(id);
        this.ordersByTrader.set(trader, traderOrders);
        const gridOrders = this.ordersByGrid.get(params.gridSessionId) || [];
        gridOrders.push(id);
        this.ordersByGrid.set(params.gridSessionId, gridOrders);
        const cellOrders = this.ordersByCell.get(params.cellId) || [];
        cellOrders.push(id);
        this.ordersByCell.set(params.cellId, cellOrders);
        this.logger.info(`✅ Created tap-to-trade order: ${id}`, {
            trader,
            symbol: params.symbol,
            triggerPrice: params.triggerPrice,
            timeWindow: `${params.startTime} - ${params.endTime}`,
        });
        return order;
    }
    batchCreateOrders(requests) {
        return requests.map((req) => this.createOrder(req));
    }
    getOrder(orderId) {
        return this.orders.get(orderId);
    }
    queryOrders(query) {
        let orders = Array.from(this.orders.values());
        if (query.trader) {
            const trader = query.trader.toLowerCase();
            const orderIds = this.ordersByTrader.get(trader) || [];
            orders = orders.filter((o) => orderIds.includes(o.id));
        }
        if (query.gridSessionId) {
            const orderIds = this.ordersByGrid.get(query.gridSessionId) || [];
            orders = orders.filter((o) => orderIds.includes(o.id));
        }
        if (query.cellId) {
            const orderIds = this.ordersByCell.get(query.cellId) || [];
            orders = orders.filter((o) => orderIds.includes(o.id));
        }
        if (query.status) {
            orders = orders.filter((o) => o.status === query.status);
        }
        return orders.sort((a, b) => a.createdAt - b.createdAt);
    }
    getPendingOrders() {
        return Array.from(this.orders.values())
            .filter((o) => o.status === tapToTrade_1.TapToTradeOrderStatus.PENDING)
            .sort((a, b) => a.createdAt - b.createdAt);
    }
    getOrdersByCell(cellId) {
        const orderIds = this.ordersByCell.get(cellId) || [];
        return orderIds
            .map((id) => this.orders.get(id))
            .filter((o) => o !== undefined);
    }
    cancelOrder(orderId, trader) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }
        const normalizedTrader = trader.toLowerCase();
        if (order.trader !== normalizedTrader) {
            throw new Error('Not authorized to cancel this order');
        }
        if (order.status !== tapToTrade_1.TapToTradeOrderStatus.PENDING && order.status !== tapToTrade_1.TapToTradeOrderStatus.NEEDS_RESIGN) {
            throw new Error(`Cannot cancel order with status: ${order.status}`);
        }
        order.status = tapToTrade_1.TapToTradeOrderStatus.CANCELLED;
        order.cancelledAt = Date.now();
        this.orders.set(orderId, order);
        this.logger.info(`✅ Cancelled tap-to-trade order: ${orderId}`);
    }
    cancelOrdersByCell(cellId, trader) {
        const orders = this.getOrdersByCell(cellId);
        let cancelledCount = 0;
        for (const order of orders) {
            try {
                if (order.status === tapToTrade_1.TapToTradeOrderStatus.PENDING) {
                    this.cancelOrder(order.id, trader);
                    cancelledCount++;
                }
            }
            catch (error) {
                this.logger.error(`Failed to cancel order ${order.id}:`, error);
            }
        }
        this.logger.info(`✅ Cancelled ${cancelledCount} orders in cell ${cellId}`);
        return cancelledCount;
    }
    cancelOrdersByGrid(gridSessionId, trader) {
        const orderIds = this.ordersByGrid.get(gridSessionId) || [];
        let cancelledCount = 0;
        for (const orderId of orderIds) {
            const order = this.orders.get(orderId);
            if (order && order.status === tapToTrade_1.TapToTradeOrderStatus.PENDING) {
                try {
                    this.cancelOrder(orderId, trader);
                    cancelledCount++;
                }
                catch (error) {
                    this.logger.error(`Failed to cancel order ${orderId}:`, error);
                }
            }
        }
        this.logger.info(`✅ Cancelled ${cancelledCount} orders in grid ${gridSessionId}`);
        return cancelledCount;
    }
    markAsExecuting(orderId) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }
        order.status = tapToTrade_1.TapToTradeOrderStatus.EXECUTING;
        this.orders.set(orderId, order);
        this.logger.info(`🚀 Order ${orderId} is now executing...`);
    }
    markAsExecuted(orderId, txHash, positionId, executionPrice) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }
        order.status = tapToTrade_1.TapToTradeOrderStatus.EXECUTED;
        order.executedAt = Date.now();
        order.txHash = txHash;
        order.positionId = positionId;
        order.executionPrice = executionPrice;
        this.orders.set(orderId, order);
        this.logger.success(`✅ Order ${orderId} executed successfully!`, {
            txHash,
            positionId,
            executionPrice,
        });
    }
    markAsFailed(orderId, errorMessage) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }
        order.status = tapToTrade_1.TapToTradeOrderStatus.FAILED;
        order.errorMessage = errorMessage;
        this.orders.set(orderId, order);
        this.logger.error(`❌ Order ${orderId} failed: ${errorMessage}`);
    }
    markAsNeedsResign(orderId, errorMessage) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }
        order.status = tapToTrade_1.TapToTradeOrderStatus.NEEDS_RESIGN;
        order.errorMessage = errorMessage;
        this.orders.set(orderId, order);
        this.logger.warn(`\u270d\ufe0f Order ${orderId} needs re-signature: ${errorMessage}`);
    }
    updateSignature(orderId, nonce, signature, trader) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }
        const normalizedTrader = trader.toLowerCase();
        if (order.trader !== normalizedTrader) {
            throw new Error('Not authorized to update this order');
        }
        if (order.status !== tapToTrade_1.TapToTradeOrderStatus.NEEDS_RESIGN) {
            throw new Error(`Order is not in NEEDS_RESIGN status: ${order.status}`);
        }
        order.nonce = nonce;
        order.signature = signature;
        order.status = tapToTrade_1.TapToTradeOrderStatus.PENDING;
        order.errorMessage = undefined;
        this.orders.set(orderId, order);
        this.logger.info(`\u2705 Updated signature for order ${orderId} with new nonce ${nonce}`);
    }
    cleanupExpiredOrders() {
        const now = Math.floor(Date.now() / 1000);
        let expiredCount = 0;
        for (const order of this.orders.values()) {
            if (order.status === tapToTrade_1.TapToTradeOrderStatus.PENDING && now > order.endTime) {
                order.status = tapToTrade_1.TapToTradeOrderStatus.EXPIRED;
                order.expiredAt = Date.now();
                this.orders.set(order.id, order);
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            this.logger.info(`🧹 Cleaned up ${expiredCount} expired tap-to-trade orders`);
        }
        return expiredCount;
    }
    getStats() {
        const orders = Array.from(this.orders.values());
        return {
            totalOrders: orders.length,
            pendingOrders: orders.filter((o) => o.status === tapToTrade_1.TapToTradeOrderStatus.PENDING).length,
            executedOrders: orders.filter((o) => o.status === tapToTrade_1.TapToTradeOrderStatus.EXECUTED).length,
            cancelledOrders: orders.filter((o) => o.status === tapToTrade_1.TapToTradeOrderStatus.CANCELLED).length,
            expiredOrders: orders.filter((o) => o.status === tapToTrade_1.TapToTradeOrderStatus.EXPIRED).length,
            failedOrders: orders.filter((o) => o.status === tapToTrade_1.TapToTradeOrderStatus.FAILED).length,
        };
    }
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.TapToTradeService = TapToTradeService;
//# sourceMappingURL=TapToTradeService.js.map