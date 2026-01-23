export interface PriceData {
    symbol: string;
    price: number;
    confidence?: number;
    expo?: number;
    timestamp: number;
    source: 'pyth' | 'binance' | 'fallback' | 'frontend';
    publishTime?: number;
}
export interface MultiAssetPriceData {
    [symbol: string]: PriceData;
}
export interface PythPriceFeed {
    id: string;
    price: {
        price: string;
        conf: string;
        expo: number;
        publish_time: number;
    };
    ema_price: {
        price: string;
        conf: string;
        expo: number;
        publish_time: number;
    };
}
export interface AssetConfig {
    symbol: string;
    pythPriceId: string;
    binanceSymbol: string;
    tradingViewSymbol: string;
}
export declare const SUPPORTED_ASSETS: AssetConfig[];
export interface TPSLConfig {
    positionId: number;
    trader: string;
    symbol: string;
    isLong: boolean;
    entryPrice: bigint;
    takeProfit?: bigint;
    stopLoss?: bigint;
    createdAt: number;
    updatedAt: number;
}
export interface TPSLCreateRequest {
    positionId: number;
    takeProfit?: string;
    stopLoss?: string;
}
export interface TPSLResponse {
    success: boolean;
    message: string;
    data?: TPSLConfig;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map