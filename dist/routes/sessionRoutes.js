"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const TapToTradeExecutor_json_1 = __importDefault(require("../abis/TapToTradeExecutor.json"));
const router = (0, express_1.Router)();
const logger = new Logger_1.Logger('SessionRoutes');
router.post('/authorize', async (req, res) => {
    try {
        const { trader, sessionKeyAddress, duration, authSignature, expiresAt } = req.body;
        if (!trader || !sessionKeyAddress || !duration || !authSignature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: trader, sessionKeyAddress, duration, authSignature',
            });
        }
        logger.info('🔑 Authorizing session key on-chain...', {
            trader,
            sessionKeyAddress,
            duration,
        });
        const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
        const provider = new ethers_1.ethers.JsonRpcProvider(RPC_URL);
        const relayerPrivateKey = process.env.RELAY_PRIVATE_KEY;
        if (!relayerPrivateKey) {
            throw new Error('RELAY_PRIVATE_KEY not configured');
        }
        const relayerWallet = new ethers_1.ethers.Wallet(relayerPrivateKey, provider);
        const tapToTradeExecutorAddress = process.env.TAP_TO_TRADE_EXECUTOR_ADDRESS || '0x841f70066ba831650c4D97BD59cc001c890cf6b6';
        const tapToTradeExecutor = new ethers_1.ethers.Contract(tapToTradeExecutorAddress, TapToTradeExecutor_json_1.default.abi, relayerWallet);
        logger.info('💰 Relayer paying gas:', relayerWallet.address);
        const expiresAtSeconds = expiresAt ? Math.floor(expiresAt / 1000) : Math.floor(Date.now() / 1000) + duration;
        logger.info('🕒 Authorization timing:', {
            expiresAtMs: expiresAt,
            expiresAtSeconds,
            duration,
        });
        const messageHash = ethers_1.ethers.solidityPackedKeccak256(['string', 'address', 'string', 'uint256'], [
            'Authorize session key ',
            sessionKeyAddress,
            ' for Tethra Tap-to-Trade until ',
            expiresAtSeconds
        ]);
        const digest = ethers_1.ethers.hashMessage(ethers_1.ethers.getBytes(messageHash));
        const recoveredSigner = ethers_1.ethers.recoverAddress(digest, authSignature);
        if (recoveredSigner.toLowerCase() !== trader.toLowerCase()) {
            logger.error('❌ Invalid signature:', {
                expected: trader,
                recovered: recoveredSigner,
            });
            return res.status(400).json({
                success: false,
                error: `Invalid signature: recovered ${recoveredSigner}, expected ${trader}`,
            });
        }
        logger.info('✅ Signature verified locally');
        const tx = await tapToTradeExecutor.authorizeSessionKey(sessionKeyAddress, duration, authSignature, { gasLimit: 300000 });
        logger.info('📤 Authorization tx sent:', tx.hash);
        const receipt = await tx.wait();
        if (receipt.status === 0) {
            throw new Error('Transaction reverted');
        }
        logger.info('✅ Session key authorized on-chain!', {
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
        });
        res.json({
            success: true,
            txHash: receipt.hash,
            receipt: {
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                status: receipt.status,
            },
        });
    }
    catch (error) {
        logger.error('❌ Failed to authorize session key:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Authorization failed',
        });
    }
});
router.get('/status', async (req, res) => {
    try {
        const { txHash } = req.query;
        if (!txHash) {
            return res.status(400).json({
                success: false,
                error: 'Missing txHash parameter',
            });
        }
        const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
        const provider = new ethers_1.ethers.JsonRpcProvider(RPC_URL);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            return res.json({
                success: true,
                confirmed: false,
                pending: true,
            });
        }
        res.json({
            success: true,
            confirmed: true,
            blockNumber: receipt.blockNumber,
            status: receipt.status,
            gasUsed: receipt.gasUsed.toString(),
        });
    }
    catch (error) {
        logger.error('❌ Failed to check status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Status check failed',
        });
    }
});
exports.default = router;
//# sourceMappingURL=sessionRoutes.js.map