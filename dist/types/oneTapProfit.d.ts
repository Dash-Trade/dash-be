export declare enum OneTapBetStatus {
    ACTIVE = "ACTIVE",
    WON = "WON",
    LOST = "LOST",
    CANCELLED = "CANCELLED"
}
export interface OneTapBet {
    betId: string;
    trader: string;
    symbol: string;
    betAmount: string;
    targetPrice: string;
    targetTime: number;
    entryPrice: string;
    entryTime: number;
    multiplier: number;
    status: OneTapBetStatus;
    settledAt?: number;
    settlePrice?: string;
    createdAt: number;
    lastChecked?: number;
}
export interface PlaceOneTapBetRequest {
    trader: string;
    symbol: string;
    betAmount: string;
    targetPrice: string;
    targetTime: number;
    entryPrice: string;
    entryTime: number;
    nonce: string;
    userSignature: string;
}
export interface PlaceOneTapBetKeeperRequest {
    trader: string;
    symbol: string;
    betAmount: string;
    targetPrice: string;
    targetTime: number;
    entryPrice: string;
    entryTime: number;
}
export interface SettleOneTapBetRequest {
    betId: string;
    currentPrice: string;
    currentTime: number;
    won: boolean;
}
export interface GetOneTapBetsQuery {
    trader?: string;
    symbol?: string;
    status?: OneTapBetStatus;
}
export interface OneTapProfitStats {
    totalBets: number;
    activeBets: number;
    wonBets: number;
    lostBets: number;
    totalVolume: string;
    totalPayout: string;
}
export interface CalculateMultiplierRequest {
    entryPrice: string;
    targetPrice: string;
    entryTime: number;
    targetTime: number;
}
export interface CalculateMultiplierResponse {
    multiplier: number;
    priceDistance: string;
    timeDistance: number;
}
//# sourceMappingURL=oneTapProfit.d.ts.map