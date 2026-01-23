export declare class PositionMonitor {
    private logger;
    private provider;
    private keeperWallet;
    private priceSignerWallet;
    private positionManager;
    private marketExecutor;
    private riskManager;
    private isRunning;
    private checkInterval;
    private currentPrices;
    constructor(pythPriceService: any);
    start(): void;
    stop(): void;
    private monitorLoop;
    private checkAllPositions;
    private getPosition;
    private checkPositionLiquidation;
    private liquidatePosition;
    private signPrice;
    private formatPrice;
    private formatUsdc;
    private sleep;
    getStatus(): {
        isRunning: boolean;
        checkInterval: number;
        trackedPrices: string[];
        keeperAddress: string;
    };
}
//# sourceMappingURL=PositionMonitor.d.ts.map