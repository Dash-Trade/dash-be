import { TPSLConfig } from '../types';
export declare class TPSLMonitor {
    private logger;
    private provider;
    private keeperWallet;
    private priceSignerWallet;
    private positionManager;
    private marketExecutor;
    private isRunning;
    private checkInterval;
    private currentPrices;
    private tpslConfigs;
    constructor(pythPriceService: any);
    start(): void;
    stop(): void;
    private monitorLoop;
    private checkAllTPSL;
    private getPosition;
    private checkTPSLTrigger;
    private closePosition;
    private signPrice;
    setTPSL(positionId: number, trader: string, takeProfit?: bigint, stopLoss?: bigint): Promise<{
        success: boolean;
        message: string;
        config?: TPSLConfig;
    }>;
    getTPSL(positionId: number): TPSLConfig | undefined;
    getAllTPSL(): TPSLConfig[];
    deleteTPSL(positionId: number, trader: string): {
        success: boolean;
        message: string;
    };
    private formatPrice;
    private sleep;
    getStatus(): {
        isRunning: boolean;
        checkInterval: number;
        activeTPSLCount: number;
        trackedPrices: string[];
        keeperAddress: string;
    };
}
//# sourceMappingURL=TPSLMonitor.d.ts.map