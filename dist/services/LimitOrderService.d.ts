export interface KeeperLimitOpenOrderRequest {
    trader: string;
    symbol: string;
    isLong: boolean;
    collateral: string;
    leverage: string;
    triggerPrice: string;
    nonce: string;
    expiresAt: string;
    signature: string;
    takeProfit?: string;
    stopLoss?: string;
    metadata?: {
        collateralUsd?: string;
        triggerPriceUsd?: string;
    };
}
export interface KeeperLimitOrderResponse {
    orderId: string;
    txHash: string;
}
export declare class LimitOrderService {
    private readonly logger;
    private readonly provider;
    private readonly keeperWallet;
    private readonly limitExecutor;
    private readonly limitExecutorAddress;
    private orderTPSLMap;
    constructor();
    private normalizeBigNumberish;
    getNextOrderId(): Promise<bigint>;
    createLimitOpenOrder(request: KeeperLimitOpenOrderRequest): Promise<KeeperLimitOrderResponse>;
    getOrderTPSL(orderId: string): {
        takeProfit?: bigint;
        stopLoss?: bigint;
    } | undefined;
    clearOrderTPSL(orderId: string): void;
}
//# sourceMappingURL=LimitOrderService.d.ts.map