export declare class RelayService {
    private logger;
    private provider;
    private relayWallet;
    private paymasterContract;
    private PAYMASTER_ADDRESS;
    private MARKET_EXECUTOR_ADDRESS;
    private LIMIT_EXECUTOR_ADDRESS;
    private POSITION_MANAGER_ADDRESS;
    private TREASURY_MANAGER_ADDRESS;
    constructor();
    canUserPayGas(userAddress: string, estimatedGas: bigint): Promise<boolean>;
    getUserDeposit(userAddress: string): Promise<bigint>;
    calculateGasCost(estimatedGas: bigint): Promise<bigint>;
    relayTransaction(to: string, data: string, userAddress: string, value?: bigint): Promise<{
        txHash: string;
        gasUsed: bigint;
        usdcCharged: bigint;
        positionId?: number;
    }>;
    closePositionGasless(userAddress: string, positionId: string, symbol: string): Promise<{
        txHash: string;
    }>;
    cancelOrderGasless(userAddress: string, orderId: string, userSignature: string): Promise<{
        txHash: string;
    }>;
    getRelayBalance(): Promise<{
        eth: bigint;
        ethFormatted: string;
    }>;
}
//# sourceMappingURL=RelayService.d.ts.map