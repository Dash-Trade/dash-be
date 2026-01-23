"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.ConfigService = void 0;
class ConfigService {
    constructor() {
        this.PORT = this.getNumber('PORT', 3001);
        this.NODE_ENV = this.get('NODE_ENV', 'development');
        this.DEBUG = this.getBoolean('DEBUG', false);
        this.BACKEND_URL = this.get('BACKEND_URL', `http://localhost:${this.PORT}`);
        this.CHAIN_ID = this.getNumberRequired('CHAIN_ID');
        this.NETWORK_NAME = this.getRequired('NETWORK_NAME');
        this.RPC_URL = this.getRequired('RPC_URL');
        this.PRICE_SIGNER_PRIVATE_KEY = this.getRequired('PRICE_SIGNER_PRIVATE_KEY');
        this.RELAY_PRIVATE_KEY = this.getRequired('RELAY_PRIVATE_KEY');
        this.validatePrivateKey(this.PRICE_SIGNER_PRIVATE_KEY, 'PRICE_SIGNER_PRIVATE_KEY');
        this.validatePrivateKey(this.RELAY_PRIVATE_KEY, 'RELAY_PRIVATE_KEY');
        this.USDC_TOKEN_ADDRESS = this.getRequired('USDC_TOKEN_ADDRESS');
        this.TETHRA_TOKEN_ADDRESS = this.getRequired('TETHRA_TOKEN_ADDRESS');
        this.MARKET_EXECUTOR_ADDRESS = this.getRequired('MARKET_EXECUTOR_ADDRESS');
        this.POSITION_MANAGER_ADDRESS = this.getRequired('POSITION_MANAGER_ADDRESS');
        this.RISK_MANAGER_ADDRESS = this.getRequired('RISK_MANAGER_ADDRESS');
        this.TREASURY_MANAGER_ADDRESS = this.getRequired('TREASURY_MANAGER_ADDRESS');
        this.LIMIT_EXECUTOR_ADDRESS = this.getRequired('LIMIT_EXECUTOR_ADDRESS');
        this.TAP_TO_TRADE_EXECUTOR_ADDRESS = this.getRequired('TAP_TO_TRADE_EXECUTOR_ADDRESS');
        this.ONE_TAP_PROFIT_ADDRESS = this.getRequired('ONE_TAP_PROFIT_ADDRESS');
        this.TETHRA_STAKING_ADDRESS = this.getRequired('TETHRA_STAKING_ADDRESS');
        this.LIQUIDITY_MINING_ADDRESS = this.getRequired('LIQUIDITY_MINING_ADDRESS');
        this.USDC_PAYMASTER_ADDRESS = this.getRequired('USDC_PAYMASTER_ADDRESS');
        this.DEPLOYER_ADDRESS = this.getRequired('DEPLOYER_ADDRESS');
        this.TREASURY_ADDRESS = this.getRequired('TREASURY_ADDRESS');
        this.PRICE_SIGNER_ADDRESS = this.getRequired('PRICE_SIGNER_ADDRESS');
        this.validateAllAddresses();
        if (this.DEBUG) {
            console.log('✅ ConfigService initialized successfully');
            console.log(`   Network: ${this.NETWORK_NAME} (Chain ID: ${this.CHAIN_ID})`);
            console.log(`   RPC URL: ${this.RPC_URL}`);
        }
    }
    get(key, defaultValue) {
        return process.env[key] ?? defaultValue ?? '';
    }
    getRequired(key) {
        const value = process.env[key];
        if (!value || value.trim() === '') {
            throw new Error(`❌ CONFIGURATION ERROR: ${key} is required but not set in environment variables.\n` +
                `   Please check your .env file and ensure ${key} is properly configured.`);
        }
        return value.trim();
    }
    getNumber(key, defaultValue) {
        const value = process.env[key];
        if (!value) {
            if (defaultValue === undefined) {
                throw new Error(`❌ CONFIGURATION ERROR: ${key} is required`);
            }
            return defaultValue;
        }
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) {
            throw new Error(`❌ CONFIGURATION ERROR: ${key} must be a valid number, got: ${value}`);
        }
        return parsed;
    }
    getNumberRequired(key) {
        return this.getNumber(key);
    }
    getBoolean(key, defaultValue = false) {
        const value = process.env[key];
        if (!value)
            return defaultValue;
        return value.toLowerCase() === 'true' || value === '1';
    }
    validatePrivateKey(key, name) {
        if (!key.startsWith('0x')) {
            throw new Error(`❌ CONFIGURATION ERROR: ${name} must start with 0x`);
        }
        if (key.length !== 66) {
            throw new Error(`❌ CONFIGURATION ERROR: ${name} must be 66 characters (0x + 64 hex chars)`);
        }
        if (!/^0x[a-fA-F0-9]{64}$/.test(key)) {
            throw new Error(`❌ CONFIGURATION ERROR: ${name} must be a valid hex string`);
        }
    }
    validateAddress(address, name) {
        if (!address.startsWith('0x')) {
            throw new Error(`❌ CONFIGURATION ERROR: ${name} must start with 0x`);
        }
        if (address.length !== 42) {
            throw new Error(`❌ CONFIGURATION ERROR: ${name} must be 42 characters (0x + 40 hex chars)`);
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            throw new Error(`❌ CONFIGURATION ERROR: ${name} must be a valid Ethereum address`);
        }
    }
    validateAllAddresses() {
        const addressesToValidate = [
            { value: this.USDC_TOKEN_ADDRESS, name: 'USDC_TOKEN_ADDRESS' },
            { value: this.TETHRA_TOKEN_ADDRESS, name: 'TETHRA_TOKEN_ADDRESS' },
            { value: this.MARKET_EXECUTOR_ADDRESS, name: 'MARKET_EXECUTOR_ADDRESS' },
            { value: this.POSITION_MANAGER_ADDRESS, name: 'POSITION_MANAGER_ADDRESS' },
            { value: this.RISK_MANAGER_ADDRESS, name: 'RISK_MANAGER_ADDRESS' },
            { value: this.TREASURY_MANAGER_ADDRESS, name: 'TREASURY_MANAGER_ADDRESS' },
            { value: this.LIMIT_EXECUTOR_ADDRESS, name: 'LIMIT_EXECUTOR_ADDRESS' },
            { value: this.TAP_TO_TRADE_EXECUTOR_ADDRESS, name: 'TAP_TO_TRADE_EXECUTOR_ADDRESS' },
            { value: this.ONE_TAP_PROFIT_ADDRESS, name: 'ONE_TAP_PROFIT_ADDRESS' },
            { value: this.TETHRA_STAKING_ADDRESS, name: 'TETHRA_STAKING_ADDRESS' },
            { value: this.LIQUIDITY_MINING_ADDRESS, name: 'LIQUIDITY_MINING_ADDRESS' },
            { value: this.USDC_PAYMASTER_ADDRESS, name: 'USDC_PAYMASTER_ADDRESS' },
            { value: this.DEPLOYER_ADDRESS, name: 'DEPLOYER_ADDRESS' },
            { value: this.TREASURY_ADDRESS, name: 'TREASURY_ADDRESS' },
            { value: this.PRICE_SIGNER_ADDRESS, name: 'PRICE_SIGNER_ADDRESS' },
        ];
        for (const { value, name } of addressesToValidate) {
            this.validateAddress(value, name);
        }
    }
    isProduction() {
        return this.NODE_ENV === 'production';
    }
    isDevelopment() {
        return this.NODE_ENV === 'development';
    }
    getAll() {
        return {
            PORT: this.PORT,
            NODE_ENV: this.NODE_ENV,
            DEBUG: this.DEBUG,
            CHAIN_ID: this.CHAIN_ID,
            NETWORK_NAME: this.NETWORK_NAME,
            RPC_URL: this.RPC_URL,
            PRICE_SIGNER_PRIVATE_KEY: '***HIDDEN***',
            RELAY_PRIVATE_KEY: '***HIDDEN***',
            USDC_TOKEN_ADDRESS: this.USDC_TOKEN_ADDRESS,
            TETHRA_TOKEN_ADDRESS: this.TETHRA_TOKEN_ADDRESS,
            MARKET_EXECUTOR_ADDRESS: this.MARKET_EXECUTOR_ADDRESS,
            POSITION_MANAGER_ADDRESS: this.POSITION_MANAGER_ADDRESS,
            RISK_MANAGER_ADDRESS: this.RISK_MANAGER_ADDRESS,
            TREASURY_MANAGER_ADDRESS: this.TREASURY_MANAGER_ADDRESS,
            LIMIT_EXECUTOR_ADDRESS: this.LIMIT_EXECUTOR_ADDRESS,
            TAP_TO_TRADE_EXECUTOR_ADDRESS: this.TAP_TO_TRADE_EXECUTOR_ADDRESS,
            ONE_TAP_PROFIT_ADDRESS: this.ONE_TAP_PROFIT_ADDRESS,
            TETHRA_STAKING_ADDRESS: this.TETHRA_STAKING_ADDRESS,
            LIQUIDITY_MINING_ADDRESS: this.LIQUIDITY_MINING_ADDRESS,
            USDC_PAYMASTER_ADDRESS: this.USDC_PAYMASTER_ADDRESS,
            DEPLOYER_ADDRESS: this.DEPLOYER_ADDRESS,
            TREASURY_ADDRESS: this.TREASURY_ADDRESS,
            PRICE_SIGNER_ADDRESS: this.PRICE_SIGNER_ADDRESS,
        };
    }
}
exports.ConfigService = ConfigService;
exports.config = new ConfigService();
//# sourceMappingURL=ConfigService.js.map