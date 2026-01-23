export declare class PriceSignerService {
    private logger;
    private signer;
    private signerAddress;
    constructor();
    private initializeSync;
    initialize(): Promise<void>;
    signPrice(asset: string, price: string | bigint, timestamp: number): Promise<{
        asset: string;
        assetId: string;
        price: string;
        timestamp: number;
        signature: string;
        signer: string;
    }>;
    verifySignature(symbol: string, price: string | bigint, timestamp: number, signature: string): string;
    getSignerAddress(): string;
    isInitialized(): boolean;
    getStatus(): {
        initialized: boolean;
        signerAddress: string;
        timestamp: number;
    };
}
//# sourceMappingURL=PriceSignerService.d.ts.map