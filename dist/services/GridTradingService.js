"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridTradingService = void 0;
const Logger_1 = require("../utils/Logger");
const gridTrading_1 = require("../types/gridTrading");
class GridTradingService {
    constructor() {
        this.logger = new Logger_1.Logger('GridTradingService');
        this.gridSessions = new Map();
        this.gridCells = new Map();
        this.userGrids = new Map();
        this.cellsByGrid = new Map();
        this.logger.info('🎯 GridTradingService initialized (in-memory storage)');
        this.logger.warn('⚠️  Data will be lost on server restart');
    }
    createGridSession(params) {
        const id = this.generateId('grid');
        const session = {
            id,
            trader: params.trader.toLowerCase(),
            symbol: params.symbol,
            marginTotal: params.marginTotal,
            leverage: params.leverage,
            timeframeSeconds: params.timeframeSeconds,
            gridSizeX: params.gridSizeX,
            gridSizeYPercent: params.gridSizeYPercent,
            referenceTime: params.referenceTime,
            referencePrice: params.referencePrice,
            isActive: true,
            createdAt: Date.now(),
        };
        this.gridSessions.set(id, session);
        const trader = session.trader;
        const userGridsList = this.userGrids.get(trader) || [];
        userGridsList.push(id);
        this.userGrids.set(trader, userGridsList);
        this.cellsByGrid.set(id, []);
        this.logger.info(`✅ Created grid session: ${id}`, {
            trader,
            symbol: params.symbol,
            marginTotal: params.marginTotal,
            leverage: params.leverage,
        });
        return session;
    }
    createGridCell(params) {
        const session = this.gridSessions.get(params.gridSessionId);
        if (!session) {
            throw new Error(`Grid session not found: ${params.gridSessionId}`);
        }
        const id = this.generateId('cell');
        const cell = {
            id,
            gridSessionId: params.gridSessionId,
            cellX: params.cellX,
            cellY: params.cellY,
            triggerPrice: params.triggerPrice,
            startTime: params.startTime,
            endTime: params.endTime,
            isLong: params.isLong,
            clickCount: params.clickCount,
            ordersCreated: 0,
            orderIds: [],
            collateralPerOrder: params.collateralPerOrder,
            status: gridTrading_1.GridCellStatus.PENDING,
            createdAt: Date.now(),
        };
        this.gridCells.set(id, cell);
        const cellsList = this.cellsByGrid.get(params.gridSessionId) || [];
        cellsList.push(id);
        this.cellsByGrid.set(params.gridSessionId, cellsList);
        this.logger.info(`✅ Created grid cell: ${id}`, {
            gridId: params.gridSessionId,
            position: `(${params.cellX}, ${params.cellY})`,
            clickCount: params.clickCount,
        });
        return cell;
    }
    addOrderToCell(cellId, orderId) {
        const cell = this.gridCells.get(cellId);
        if (!cell) {
            throw new Error(`Cell not found: ${cellId}`);
        }
        cell.orderIds.push(orderId);
        cell.ordersCreated++;
        if (cell.status === gridTrading_1.GridCellStatus.PENDING) {
            cell.status = gridTrading_1.GridCellStatus.ACTIVE;
        }
        this.gridCells.set(cellId, cell);
        this.logger.info(`✅ Added order ${orderId} to cell ${cellId} (${cell.ordersCreated}/${cell.clickCount})`);
    }
    getUserGrids(trader) {
        const normalizedTrader = trader.toLowerCase();
        const gridIds = this.userGrids.get(normalizedTrader) || [];
        return gridIds
            .map((id) => this.gridSessions.get(id))
            .filter((s) => s !== undefined)
            .sort((a, b) => b.createdAt - a.createdAt);
    }
    getGridCells(gridSessionId) {
        const cellIds = this.cellsByGrid.get(gridSessionId) || [];
        return cellIds
            .map((id) => this.gridCells.get(id))
            .filter((c) => c !== undefined);
    }
    getGridSessionWithCells(gridSessionId) {
        const session = this.gridSessions.get(gridSessionId);
        if (!session) {
            return null;
        }
        const cells = this.getGridCells(gridSessionId);
        const totalOrders = cells.reduce((sum, cell) => sum + cell.clickCount, 0);
        const activeOrders = cells
            .filter((cell) => cell.status === gridTrading_1.GridCellStatus.ACTIVE)
            .reduce((sum, cell) => sum + (cell.clickCount - cell.ordersCreated), 0);
        const executedOrders = cells.reduce((sum, cell) => sum + cell.ordersCreated, 0);
        return {
            gridSession: session,
            cells,
            totalOrders,
            activeOrders,
            executedOrders,
        };
    }
    getActiveCells() {
        const activeCells = [];
        for (const cell of this.gridCells.values()) {
            if (cell.status === gridTrading_1.GridCellStatus.ACTIVE) {
                const session = this.gridSessions.get(cell.gridSessionId);
                if (session?.isActive) {
                    activeCells.push(cell);
                }
            }
        }
        return activeCells;
    }
    updateCellStatus(cellId, status) {
        const cell = this.gridCells.get(cellId);
        if (!cell) {
            throw new Error(`Cell not found: ${cellId}`);
        }
        cell.status = status;
        this.gridCells.set(cellId, cell);
        this.logger.info(`✅ Updated cell ${cellId} status: ${status}`);
    }
    cancelGridSession(gridId, trader) {
        const session = this.gridSessions.get(gridId);
        if (!session) {
            throw new Error(`Grid session not found: ${gridId}`);
        }
        const normalizedTrader = trader.toLowerCase();
        if (session.trader !== normalizedTrader) {
            throw new Error('Not authorized to cancel this grid');
        }
        session.isActive = false;
        session.cancelledAt = Date.now();
        this.gridSessions.set(gridId, session);
        const cells = this.getGridCells(gridId);
        for (const cell of cells) {
            if (cell.status === gridTrading_1.GridCellStatus.ACTIVE || cell.status === gridTrading_1.GridCellStatus.PENDING) {
                cell.status = gridTrading_1.GridCellStatus.CANCELLED;
                this.gridCells.set(cell.id, cell);
            }
        }
        this.logger.info(`✅ Cancelled grid session: ${gridId}`);
    }
    cancelGridCell(cellId, trader) {
        const cell = this.gridCells.get(cellId);
        if (!cell) {
            throw new Error(`Cell not found: ${cellId}`);
        }
        const session = this.gridSessions.get(cell.gridSessionId);
        if (!session) {
            throw new Error(`Grid session not found for cell: ${cellId}`);
        }
        const normalizedTrader = trader.toLowerCase();
        if (session.trader !== normalizedTrader) {
            throw new Error('Not authorized to cancel this cell');
        }
        if (cell.status !== gridTrading_1.GridCellStatus.ACTIVE && cell.status !== gridTrading_1.GridCellStatus.PENDING) {
            throw new Error(`Cannot cancel cell with status: ${cell.status}`);
        }
        cell.status = gridTrading_1.GridCellStatus.CANCELLED;
        this.gridCells.set(cellId, cell);
        this.logger.info(`✅ Cancelled grid cell: ${cellId}`);
    }
    getGridSession(gridId) {
        return this.gridSessions.get(gridId);
    }
    getGridCell(cellId) {
        return this.gridCells.get(cellId);
    }
    cleanupExpiredCells() {
        const now = Math.floor(Date.now() / 1000);
        let expiredCount = 0;
        for (const cell of this.gridCells.values()) {
            if (cell.status === gridTrading_1.GridCellStatus.ACTIVE && now > cell.endTime) {
                cell.status = gridTrading_1.GridCellStatus.EXPIRED;
                this.gridCells.set(cell.id, cell);
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            this.logger.info(`🧹 Cleaned up ${expiredCount} expired cells`);
        }
        return expiredCount;
    }
    getStats() {
        const activeSessions = Array.from(this.gridSessions.values()).filter((s) => s.isActive).length;
        const activeCells = Array.from(this.gridCells.values()).filter((c) => c.status === gridTrading_1.GridCellStatus.ACTIVE).length;
        const totalOrders = Array.from(this.gridCells.values()).reduce((sum, cell) => sum + cell.orderIds.length, 0);
        return {
            totalSessions: this.gridSessions.size,
            activeSessions,
            totalCells: this.gridCells.size,
            activeCells,
            totalOrders,
            uniqueTraders: this.userGrids.size,
        };
    }
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.GridTradingService = GridTradingService;
//# sourceMappingURL=GridTradingService.js.map