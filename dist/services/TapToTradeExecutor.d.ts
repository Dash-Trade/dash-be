import { TapToTradeService } from './TapToTradeService';
export declare class TapToTradeExecutor {
    private logger;
    private provider;
    private keeperWallet;
    private tapToTradeExecutor;
    private tapToTradeExecutorAddress;
    private priceSignerWallet;
    private priceSignerAddress;
    private tapToTradeService;
    private isRunning;
    private checkInterval;
    private currentPrices;
    private lastCleanupTime;
    private cleanupInterval;
    constructor(pythPriceService: any, tapToTradeService: TapToTradeService);
    start(): void;
    stop(): void;
    private monitorLoop;
    private cleanupExpiredOrders;
    private checkAndExecuteOrders;
    private executeOrder;
    private signPrice;
    private formatPrice;
    private sleep;
    getStatus(): {
        isRunning: boolean;
        checkInterval: number;
        trackedPrices: string[];
        keeperAddress: string;
        pendingOrders: number;
    };
}
//# sourceMappingURL=TapToTradeExecutor.d.ts.map