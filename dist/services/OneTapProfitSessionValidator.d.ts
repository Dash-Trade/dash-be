export declare class OneTapProfitSessionValidator {
    private logger;
    constructor();
    validateBetWithSession(params: {
        trader: string;
        symbol: string;
        betAmount: string;
        targetPrice: string;
        targetTime: number;
        nonce: string;
        signature: string;
        contractAddress: string;
        sessionKey: {
            address: string;
            expiresAt: number;
            authorizedBy: string;
            authSignature: string;
        };
    }): {
        valid: boolean;
        error?: string;
    };
    validateBetWithoutSession(params: {
        trader: string;
        symbol: string;
        betAmount: string;
        targetPrice: string;
        targetTime: number;
        nonce: string;
        signature: string;
        contractAddress: string;
    }): {
        valid: boolean;
        error?: string;
    };
}
//# sourceMappingURL=OneTapProfitSessionValidator.d.ts.map