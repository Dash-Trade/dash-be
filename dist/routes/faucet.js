"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFaucetRoute = createFaucetRoute;
const express_1 = require("express");
const Logger_1 = require("../utils/Logger");
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const logger = new Logger_1.Logger('FaucetRoute');
const MOCK_USDC_ABI = [
    {
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        name: 'mint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
];
function createFaucetRoute() {
    const router = (0, express_1.Router)();
    router.post('/claim', async (req, res) => {
        try {
            const { address, amount = '100' } = req.body;
            if (!address) {
                return res.status(400).json({
                    success: false,
                    error: 'Address is required',
                    timestamp: Date.now()
                });
            }
            if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid address format',
                    timestamp: Date.now()
                });
            }
            const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x9d660c5d4BFE4b7fcC76f327b22ABF7773DD48c1';
            const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
            if (!faucetPrivateKey) {
                logger.error('FAUCET_PRIVATE_KEY not configured in environment');
                return res.status(500).json({
                    success: false,
                    error: 'Faucet not configured. Please contact administrator.',
                    timestamp: Date.now()
                });
            }
            const account = (0, accounts_1.privateKeyToAccount)(faucetPrivateKey);
            const walletClient = (0, viem_1.createWalletClient)({
                account,
                chain: chains_1.baseSepolia,
                transport: (0, viem_1.http)(rpcUrl),
            });
            const publicClient = (0, viem_1.createPublicClient)({
                chain: chains_1.baseSepolia,
                transport: (0, viem_1.http)(rpcUrl),
            });
            const amountToMint = (0, viem_1.parseUnits)(amount, 6);
            logger.info(`Minting ${amount} USDC to ${address}...`);
            const hash = await walletClient.writeContract({
                address: usdcAddress,
                abi: MOCK_USDC_ABI,
                functionName: 'mint',
                args: [address, amountToMint],
            });
            logger.info(`Transaction submitted: ${hash}`);
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 1
            });
            logger.success(`Successfully minted ${amount} USDC to ${address}`);
            return res.json({
                success: true,
                data: {
                    transactionHash: hash,
                    amount: amount,
                    recipient: address,
                    status: receipt.status,
                    blockNumber: receipt.blockNumber.toString(),
                    explorerUrl: `https://sepolia.basescan.org/tx/${hash}`
                },
                message: `Successfully claimed ${amount} USDC`,
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error claiming from faucet:', error);
            let errorMessage = 'Failed to claim USDC from faucet';
            if (error?.message?.includes('mint')) {
                errorMessage = 'This contract does not support minting. Please use a different faucet.';
            }
            else if (error?.message?.includes('insufficient funds')) {
                errorMessage = 'Faucet has insufficient funds. Please contact administrator.';
            }
            else if (error?.message) {
                errorMessage = error.message;
            }
            return res.status(500).json({
                success: false,
                error: errorMessage,
                timestamp: Date.now()
            });
        }
    });
    router.get('/status', async (req, res) => {
        try {
            const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;
            if (!faucetPrivateKey) {
                return res.json({
                    success: true,
                    data: {
                        enabled: false,
                        message: 'Faucet not configured'
                    },
                    timestamp: Date.now()
                });
            }
            const account = (0, accounts_1.privateKeyToAccount)(faucetPrivateKey);
            const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';
            const publicClient = (0, viem_1.createPublicClient)({
                chain: chains_1.baseSepolia,
                transport: (0, viem_1.http)(rpcUrl),
            });
            const balance = await publicClient.getBalance({
                address: account.address,
            });
            return res.json({
                success: true,
                data: {
                    enabled: true,
                    faucetAddress: account.address,
                    ethBalance: (Number(balance) / 1e18).toFixed(6),
                    defaultAmount: '100',
                    network: 'Base Sepolia',
                    chainId: 84532
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            logger.error('Error getting faucet status:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to get faucet status',
                timestamp: Date.now()
            });
        }
    });
    return router;
}
//# sourceMappingURL=faucet.js.map