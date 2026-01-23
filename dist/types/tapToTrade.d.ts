export declare enum TapToTradeOrderStatus {
    PENDING = "PENDING",
    NEEDS_RESIGN = "NEEDS_RESIGN",
    EXECUTING = "EXECUTING",
    EXECUTED = "EXECUTED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED",
    FAILED = "FAILED"
}
export interface TapToTradeOrder {
    id: string;
    gridSessionId: string;
    cellId: string;
    trader: string;
    symbol: string;
    isLong: boolean;
    collateral: string;
    leverage: number;
    triggerPrice: string;
    startTime: number;
    endTime: number;
    nonce: string;
    signature: string;
    sessionKey?: {
        address: string;
        expiresAt: number;
        authorizedBy: string;
        authSignature: string;
    };
    status: TapToTradeOrderStatus;
    createdAt: number;
    executedAt?: number;
    cancelledAt?: number;
    expiredAt?: number;
    txHash?: string;
    positionId?: string;
    executionPrice?: string;
    errorMessage?: string;
}
export interface CreateTapToTradeOrderRequest {
    gridSessionId: string;
    cellId: string;
    trader: string;
    symbol: string;
    isLong: boolean;
    collateral: string;
    leverage: number;
    triggerPrice: string;
    startTime: number;
    endTime: number;
    nonce: string;
    signature: string;
    sessionKey?: {
        address: string;
        expiresAt: number;
        authorizedBy: string;
        authSignature: string;
    };
}
export interface BatchCreateTapToTradeOrdersRequest {
    gridSessionId: string;
    orders: CreateTapToTradeOrderRequest[];
}
export interface CancelTapToTradeOrderRequest {
    orderId: string;
    trader: string;
}
export interface GetTapToTradeOrdersQuery {
    trader?: string;
    gridSessionId?: string;
    cellId?: string;
    status?: TapToTradeOrderStatus;
}
export interface TapToTradeOrderStats {
    totalOrders: number;
    pendingOrders: number;
    executedOrders: number;
    cancelledOrders: number;
    expiredOrders: number;
    failedOrders: number;
}
//# sourceMappingURL=tapToTrade.d.ts.map