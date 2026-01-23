import { PriceData, MultiAssetPriceData } from '../types';
export declare class PythPriceService {
    private logger;
    private currentPrices;
    private priceUpdateCallbacks;
    private pythWs;
    private readonly PYTH_HERMES_WS;
    private reconnectAttempts;
    private maxReconnectAttempts;
    constructor();
    initialize(): Promise<void>;
    private connectPythWebSocket;
    private processPriceUpdate;
    private attemptReconnect;
    private notifyPriceUpdate;
    getCurrentPrices(): MultiAssetPriceData;
    getCurrentPrice(symbol: string): PriceData | null;
    onPriceUpdate(callback: (prices: MultiAssetPriceData) => void): void;
    removePriceUpdateCallback(callback: (prices: MultiAssetPriceData) => void): void;
    getHealthStatus(): {
        status: string;
        lastUpdate: number;
        assetsMonitored: number;
    };
    shutdown(): Promise<void>;
}
//# sourceMappingURL=PythPriceService.d.ts.map