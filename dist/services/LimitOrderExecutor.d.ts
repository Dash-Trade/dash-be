import { GridTradingService } from './GridTradingService';
export declare class LimitOrderExecutor {
    private logger;
    private provider;
    private keeperWallet;
    private limitExecutor;
    private limitExecutorAddress;
    private priceSignerAddress;
    private priceSignerWallet;
    private isRunning;
    private checkInterval;
    private currentPrices;
    private gridService?;
    private tpslMonitor?;
    private limitOrderService?;
    private lastCleanupTime;
    private cleanupInterval;
    private tradingPairAddress;
    constructor(pythPriceService: any, gridService?: GridTradingService, tpslMonitor?: any, limitOrderService?: any);
    start(): void;
    stop(): void;
    private monitorLoop;
    private cleanupExpiredGridCells;
    private shouldExecuteGridOrder;
    private checkAndExecuteOrders;
    private executeOrder;
    private signPrice;
    private formatPrice;
    private formatUsdc;
    private autoSetTPSLDirect;
    private sleep;
    getStatus(): {
        isRunning: boolean;
        checkInterval: number;
        trackedPrices: string[];
        keeperAddress: string;
    };
}
//# sourceMappingURL=LimitOrderExecutor.d.ts.map