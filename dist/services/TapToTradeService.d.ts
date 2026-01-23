import { TapToTradeOrder, CreateTapToTradeOrderRequest, GetTapToTradeOrdersQuery, TapToTradeOrderStats } from '../types/tapToTrade';
export declare class TapToTradeService {
    private readonly logger;
    private readonly sessionValidator;
    private orders;
    private ordersByTrader;
    private ordersByGrid;
    private ordersByCell;
    constructor();
    createOrder(params: CreateTapToTradeOrderRequest): TapToTradeOrder;
    batchCreateOrders(requests: CreateTapToTradeOrderRequest[]): TapToTradeOrder[];
    getOrder(orderId: string): TapToTradeOrder | undefined;
    queryOrders(query: GetTapToTradeOrdersQuery): TapToTradeOrder[];
    getPendingOrders(): TapToTradeOrder[];
    getOrdersByCell(cellId: string): TapToTradeOrder[];
    cancelOrder(orderId: string, trader: string): void;
    cancelOrdersByCell(cellId: string, trader: string): number;
    cancelOrdersByGrid(gridSessionId: string, trader: string): number;
    markAsExecuting(orderId: string): void;
    markAsExecuted(orderId: string, txHash: string, positionId: string, executionPrice: string): void;
    markAsFailed(orderId: string, errorMessage: string): void;
    markAsNeedsResign(orderId: string, errorMessage: string): void;
    updateSignature(orderId: string, nonce: string, signature: string, trader: string): void;
    cleanupExpiredOrders(): number;
    getStats(): TapToTradeOrderStats;
    private generateId;
}
//# sourceMappingURL=TapToTradeService.d.ts.map