"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRelayRoute = createRelayRoute;
const express_1 = require("express");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger('RelayRoute');
function createRelayRoute(relayService) {
    const router = (0, express_1.Router)();
    router.get('/balance/:address', async (req, res) => {
        try {
            const { address } = req.params;
            if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address format',
                    timestamp: Date.now()
                });
            }
            const deposit = await relayService.getUserDeposit(address);
            res.json({
                success: true,
                data: {
                    address,
                    deposit: deposit.toString(),
                    depositFormatted: (Number(deposit) / 1e6).toFixed(2) + ' USDC'
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error getting balance:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get balance',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.post('/calculate-cost', async (req, res) => {
        try {
            const { estimatedGas } = req.body;
            if (!estimatedGas) {
                return res.status(400).json({
                    success: false,
                    error: 'estimatedGas is required',
                    timestamp: Date.now()
                });
            }
            const gasBigInt = BigInt(estimatedGas);
            const usdcCost = await relayService.calculateGasCost(gasBigInt);
            res.json({
                success: true,
                data: {
                    estimatedGas: estimatedGas,
                    usdcCost: usdcCost.toString(),
                    usdcCostFormatted: (Number(usdcCost) / 1e6).toFixed(4) + ' USDC'
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error calculating cost:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to calculate cost',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.post('/transaction', async (req, res) => {
        try {
            const { to, data, userAddress, value } = req.body;
            if (!to || !data || !userAddress) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    required: ['to', 'data', 'userAddress'],
                    timestamp: Date.now()
                });
            }
            if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid "to" address format',
                    timestamp: Date.now()
                });
            }
            if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid "userAddress" format',
                    timestamp: Date.now()
                });
            }
            if (!/^0x[a-fA-F0-9]+$/.test(data)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid "data" format (must be hex string)',
                    timestamp: Date.now()
                });
            }
            logger.info(`📨 Relay request from ${userAddress} to ${to}`);
            const valueBigInt = value ? BigInt(value) : 0n;
            const result = await relayService.relayTransaction(to, data, userAddress, valueBigInt);
            logger.success(`✅ Transaction relayed: ${result.txHash}`);
            res.json({
                success: true,
                data: {
                    txHash: result.txHash,
                    gasUsed: result.gasUsed.toString(),
                    usdcCharged: result.usdcCharged.toString(),
                    usdcChargedFormatted: (Number(result.usdcCharged) / 1e6).toFixed(4) + ' USDC',
                    explorerUrl: `https://sepolia.basescan.org/tx/${result.txHash}`,
                    positionId: result.positionId
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error relaying transaction:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to relay transaction',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.post('/can-afford', async (req, res) => {
        try {
            const { userAddress, estimatedGas } = req.body;
            if (!userAddress || !estimatedGas) {
                return res.status(400).json({
                    success: false,
                    error: 'userAddress and estimatedGas are required',
                    timestamp: Date.now()
                });
            }
            const gasBigInt = BigInt(estimatedGas);
            const canPay = await relayService.canUserPayGas(userAddress, gasBigInt);
            const deposit = await relayService.getUserDeposit(userAddress);
            const required = await relayService.calculateGasCost(gasBigInt);
            res.json({
                success: true,
                data: {
                    canAfford: canPay,
                    userDeposit: deposit.toString(),
                    requiredUsdc: required.toString(),
                    depositFormatted: (Number(deposit) / 1e6).toFixed(2) + ' USDC',
                    requiredFormatted: (Number(required) / 1e6).toFixed(4) + ' USDC'
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error checking affordability:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check affordability',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.post('/cancel-order', async (req, res) => {
        try {
            const { userAddress, orderId, signature } = req.body;
            if (!userAddress || !orderId || !signature) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    required: ['userAddress', 'orderId', 'signature'],
                    timestamp: Date.now()
                });
            }
            logger.info(`❌ GASLESS CANCEL: Order ${orderId} for user ${userAddress}`);
            const result = await relayService.cancelOrderGasless(userAddress, orderId, signature);
            logger.success(`✅ Order ${orderId} cancelled! TX: ${result.txHash}`);
            res.json({
                success: true,
                data: {
                    txHash: result.txHash,
                    orderId: orderId,
                    explorerUrl: `https://sepolia.basescan.org/tx/${result.txHash}`
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error cancelling order gasless:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel order',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.post('/close-position', async (req, res) => {
        try {
            const { userAddress, positionId, symbol } = req.body;
            if (!userAddress || !positionId || !symbol) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    required: ['userAddress', 'positionId', 'symbol'],
                    timestamp: Date.now()
                });
            }
            logger.info(`🔥 GASLESS CLOSE: Position ${positionId} for user ${userAddress}`);
            const result = await relayService.closePositionGasless(userAddress, positionId, symbol);
            logger.success(`✅ Position ${positionId} closed! TX: ${result.txHash}`);
            res.json({
                success: true,
                data: {
                    txHash: result.txHash,
                    positionId: positionId,
                    explorerUrl: `https://sepolia.basescan.org/tx/${result.txHash}`
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error closing position gasless:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to close position',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.get('/status', async (req, res) => {
        try {
            const balance = await relayService.getRelayBalance();
            res.json({
                success: true,
                data: {
                    relayWalletBalance: balance.ethFormatted + ' ETH',
                    status: parseFloat(balance.ethFormatted) > 0.01 ? 'healthy' : 'low_balance',
                    warning: parseFloat(balance.ethFormatted) < 0.01 ? 'Relay wallet needs ETH refill' : null
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error getting status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get status',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    return router;
}
//# sourceMappingURL=relay.js.map