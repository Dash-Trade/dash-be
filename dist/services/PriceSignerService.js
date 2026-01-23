"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PriceSignerService = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
class PriceSignerService {
    constructor() {
        this.signer = null;
        this.signerAddress = '';
        this.logger = new Logger_1.Logger('PriceSignerService');
        this.initializeSync();
    }
    initializeSync() {
        try {
            const privateKey = config_1.config.PRICE_SIGNER_PRIVATE_KEY;
            this.signer = new ethers_1.ethers.Wallet(privateKey);
            this.signerAddress = this.signer.address;
            this.logger.success('✅ Price Signer initialized');
            this.logger.info(`📝 Signer Address: ${this.signerAddress}`);
            this.logger.info('💡 Note: No gas needed - signing is off-chain!');
            if (config_1.config.PRICE_SIGNER_ADDRESS.toLowerCase() !== this.signerAddress.toLowerCase()) {
                this.logger.warn(`⚠️  Warning: Signer address ${this.signerAddress} doesn't match expected ${config_1.config.PRICE_SIGNER_ADDRESS}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize Price Signer:', error);
            this.signer = null;
            this.signerAddress = '';
        }
    }
    async initialize() {
        try {
            const privateKey = config_1.config.PRICE_SIGNER_PRIVATE_KEY;
            this.signer = new ethers_1.ethers.Wallet(privateKey);
            this.signerAddress = this.signer.address;
            this.logger.success('✅ Price Signer initialized');
            this.logger.info(`📝 Signer Address: ${this.signerAddress}`);
            this.logger.info('💡 Note: No gas needed - signing is off-chain!');
            if (config_1.config.PRICE_SIGNER_ADDRESS.toLowerCase() !== this.signerAddress.toLowerCase()) {
                this.logger.warn(`⚠️  Warning: Signer address ${this.signerAddress} doesn't match expected ${config_1.config.PRICE_SIGNER_ADDRESS}`);
            }
        }
        catch (error) {
            this.logger.error('Failed to initialize Price Signer:', error);
            throw error;
        }
    }
    async signPrice(asset, price, timestamp) {
        if (!this.signer) {
            throw new Error('Price Signer not initialized');
        }
        try {
            const assetId = ethers_1.ethers.id(asset);
            const priceBigInt = typeof price === 'string' ? BigInt(price) : price;
            const messageHash = ethers_1.ethers.solidityPackedKeccak256(['string', 'uint256', 'uint256'], [asset, priceBigInt, timestamp]);
            const signature = await this.signer.signMessage(ethers_1.ethers.getBytes(messageHash));
            this.logger.debug(`Signed price for ${asset}: $${Number(priceBigInt) / 1e8}`);
            return {
                asset,
                assetId,
                price: priceBigInt.toString(),
                timestamp,
                signature,
                signer: this.signerAddress
            };
        }
        catch (error) {
            this.logger.error(`Failed to sign price for ${asset}:`, error);
            throw error;
        }
    }
    verifySignature(symbol, price, timestamp, signature) {
        try {
            const priceBigInt = typeof price === 'string' ? BigInt(price) : price;
            const messageHash = ethers_1.ethers.solidityPackedKeccak256(['string', 'uint256', 'uint256'], [symbol, priceBigInt, timestamp]);
            const recoveredAddress = ethers_1.ethers.verifyMessage(ethers_1.ethers.getBytes(messageHash), signature);
            return recoveredAddress;
        }
        catch (error) {
            this.logger.error('Failed to verify signature:', error);
            throw error;
        }
    }
    getSignerAddress() {
        return this.signerAddress;
    }
    isInitialized() {
        return this.signer !== null;
    }
    getStatus() {
        return {
            initialized: this.isInitialized(),
            signerAddress: this.signerAddress,
            timestamp: Date.now()
        };
    }
}
exports.PriceSignerService = PriceSignerService;
//# sourceMappingURL=PriceSignerService.js.map