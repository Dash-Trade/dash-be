export declare class SessionKeyValidator {
    private logger;
    constructor();
    validateOrderWithSession(params: {
        trader: string;
        symbol: string;
        isLong: boolean;
        collateral: string;
        leverage: number;
        nonce: string;
        signature: string;
        marketExecutor: string;
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
    validateOrderWithoutSession(params: {
        trader: string;
        symbol: string;
        isLong: boolean;
        collateral: string;
        leverage: number;
        nonce: string;
        signature: string;
        marketExecutor: string;
    }): {
        valid: boolean;
        error?: string;
    };
}
//# sourceMappingURL=SessionKeyValidator.d.ts.map