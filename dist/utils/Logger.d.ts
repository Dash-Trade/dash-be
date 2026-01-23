export declare class Logger {
    private context;
    constructor(context: string);
    private formatMessage;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: any): void;
    debug(message: string, data?: any): void;
    success(message: string, data?: any): void;
}
//# sourceMappingURL=Logger.d.ts.map