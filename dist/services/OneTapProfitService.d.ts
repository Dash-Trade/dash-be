import { OneTapBet, PlaceOneTapBetRequest, PlaceOneTapBetKeeperRequest, GetOneTapBetsQuery, OneTapProfitStats, CalculateMultiplierRequest, CalculateMultiplierResponse } from '../types/oneTapProfit';
export declare class OneTapProfitService {
    private readonly logger;
    private contract;
    private provider;
    private relayer;
    private bets;
    private betsByTrader;
    constructor();
    placeBetByKeeper(request: PlaceOneTapBetKeeperRequest): Promise<{
        betId: string;
        txHash: string;
    }>;
    placeBet(request: PlaceOneTapBetRequest): Promise<{
        betId: string;
        txHash: string;
    }>;
    syncBetFromChain(betId: string): Promise<OneTapBet>;
    getBet(betId: string): Promise<OneTapBet | null>;
    queryBets(query: GetOneTapBetsQuery): Promise<OneTapBet[]>;
    getActiveBets(): OneTapBet[];
    calculateMultiplier(request: CalculateMultiplierRequest): Promise<CalculateMultiplierResponse>;
    getStats(): OneTapProfitStats;
    getContractAddress(): string;
    settleBet(betId: string, currentPrice: string, currentTime: number, won: boolean): Promise<void>;
    private mapStatus;
}
//# sourceMappingURL=OneTapProfitService.d.ts.map