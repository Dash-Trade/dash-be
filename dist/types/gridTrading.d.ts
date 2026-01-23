export interface GridSession {
    id: string;
    trader: string;
    symbol: string;
    marginTotal: string;
    leverage: number;
    timeframeSeconds: number;
    gridSizeX: number;
    gridSizeYPercent: number;
    referenceTime: number;
    referencePrice: string;
    isActive: boolean;
    createdAt: number;
    cancelledAt?: number;
}
export interface GridCell {
    id: string;
    gridSessionId: string;
    cellX: number;
    cellY: number;
    triggerPrice: string;
    startTime: number;
    endTime: number;
    isLong: boolean;
    clickCount: number;
    ordersCreated: number;
    orderIds: string[];
    collateralPerOrder: string;
    status: GridCellStatus;
    createdAt: number;
}
export declare enum GridCellStatus {
    PENDING = "PENDING",
    ACTIVE = "ACTIVE",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED",
    FULLY_EXECUTED = "FULLY_EXECUTED"
}
export interface CreateGridSessionRequest {
    trader: string;
    symbol: string;
    marginTotal: string;
    leverage: number;
    timeframeSeconds: number;
    gridSizeX: number;
    gridSizeYPercent: number;
    referenceTime: number;
    referencePrice: string;
}
export interface CreateGridCellRequest {
    gridSessionId: string;
    cellX: number;
    cellY: number;
    triggerPrice: string;
    startTime: number;
    endTime: number;
    isLong: boolean;
    clickCount: number;
    collateralPerOrder: string;
}
export interface GridSessionResponse {
    gridSession: GridSession;
    cells: GridCell[];
    totalOrders: number;
    activeOrders: number;
    executedOrders: number;
}
//# sourceMappingURL=gridTrading.d.ts.map