"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitOrderService = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
const LimitExecutorV2_json_1 = __importDefault(require("../abis/LimitExecutorV2.json"));
class LimitOrderService {
    constructor() {
        this.logger = new Logger_1.Logger('LimitOrderService');
        this.orderTPSLMap = new Map();
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.keeperWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, this.provider);
        this.limitExecutorAddress = config_1.config.LIMIT_EXECUTOR_ADDRESS;
        this.limitExecutor = new ethers_1.Contract(this.limitExecutorAddress, LimitExecutorV2_json_1.default.abi, this.keeperWallet);
        this.logger.info('🔄 LimitOrderService initialized');
        this.logger.info(`   Keeper wallet: ${this.keeperWallet.address}`);
        this.logger.info(`   LimitExecutorV2: ${this.limitExecutorAddress}`);
    }
    normalizeBigNumberish(value, label) {
        try {
            return BigInt(value);
        }
        catch (error) {
            throw new Error(`Invalid ${label} value: ${value}`);
        }
    }
    async getNextOrderId() {
        const nextId = await this.limitExecutor.nextOrderId();
        return BigInt(nextId);
    }
    async createLimitOpenOrder(request) {
        const { trader, symbol, isLong, collateral, leverage, triggerPrice, nonce, expiresAt, signature, metadata, } = request;
        this.logger.info(`📝 Received limit order request`, {
            trader,
            symbol,
            isLong,
            leverage,
            collateral,
            triggerPrice,
            nonce,
            expiresAt,
            metadata,
        });
        const collateralBig = this.normalizeBigNumberish(collateral, 'collateral');
        const leverageBig = this.normalizeBigNumberish(leverage, 'leverage');
        const triggerPriceBig = this.normalizeBigNumberish(triggerPrice, 'triggerPrice');
        const nonceBig = this.normalizeBigNumberish(nonce, 'nonce');
        const expiresAtBig = this.normalizeBigNumberish(expiresAt, 'expiresAt');
        if (!signature || !signature.startsWith('0x')) {
            throw new Error('Invalid signature');
        }
        const nextOrderId = await this.getNextOrderId();
        this.logger.info(`➡️  Next order id: ${nextOrderId.toString()}`);
        if (request.takeProfit || request.stopLoss) {
            const tpslData = {};
            if (request.takeProfit) {
                tpslData.takeProfit = this.normalizeBigNumberish(request.takeProfit, 'takeProfit');
            }
            if (request.stopLoss) {
                tpslData.stopLoss = this.normalizeBigNumberish(request.stopLoss, 'stopLoss');
            }
            this.orderTPSLMap.set(nextOrderId.toString(), tpslData);
            this.logger.info(`💾 Stored TP/SL for order ${nextOrderId}:`, {
                takeProfit: request.takeProfit,
                stopLoss: request.stopLoss,
            });
        }
        const tx = await this.limitExecutor.createLimitOpenOrder(trader, symbol, isLong, collateralBig, leverageBig, triggerPriceBig, nonceBig, expiresAtBig, signature);
        this.logger.info(`📤 Submitted createLimitOpenOrder tx: ${tx.hash}`);
        const receipt = await tx.wait();
        if (!receipt) {
            throw new Error('Transaction receipt not found');
        }
        this.logger.success(`✅ Limit order created on-chain`, {
            orderId: nextOrderId.toString(),
            txHash: tx.hash,
        });
        return {
            orderId: nextOrderId.toString(),
            txHash: tx.hash,
        };
    }
    getOrderTPSL(orderId) {
        return this.orderTPSLMap.get(orderId);
    }
    clearOrderTPSL(orderId) {
        this.orderTPSLMap.delete(orderId);
    }
}
exports.LimitOrderService = LimitOrderService;
//# sourceMappingURL=LimitOrderService.js.map