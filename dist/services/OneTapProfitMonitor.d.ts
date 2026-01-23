import { PythPriceService } from './PythPriceService';
import { OneTapProfitService } from './OneTapProfitService';
export declare class OneTapProfitMonitor {
    private readonly logger;
    private priceService;
    private oneTapService;
    private contract;
    private relayer;
    private intervalId?;
    private isRunning;
    private priceHistory;
    private previousPrices;
    private isSettling;
    private settlementQueue;
    private queuedBets;
    constructor(priceService: PythPriceService, oneTapService: OneTapProfitService);
    start(): void;
    stop(): void;
    private checkBets;
    private processSettlementQueue;
    private settleBet;
    private hasPriceCrossedTarget;
    private checkTargetReached;
    getStatus(): {
        isRunning: boolean;
        activeBets: number;
        monitoredPrices: number;
    };
}
//# sourceMappingURL=OneTapProfitMonitor.d.ts.map