import { Router, Request, Response } from 'express';
import { Logger } from '../utils/Logger';
import { createWalletClient, http, parseUnits, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const logger = new Logger('FaucetRoute');

// Simple ERC20 Mint ABI for testing/mock tokens
const MOCK_ERC20_ABI = [
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
] as const;

const FAUCET_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const USDC_FAUCET_AMOUNT = '10';
const IDRX_FAUCET_AMOUNT = '100000';
const faucetClaims = new Map<string, number>();
let faucetQueue: Promise<void> = Promise.resolve();
const isReceiptSuccess = (status: unknown): boolean =>
  status === 'success' || status === 1 || status === 1n;

const formatCooldown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const withFaucetLock = async <T>(fn: () => Promise<T>): Promise<T> => {
  const start = faucetQueue;
  let release: () => void;
  faucetQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await start;
  try {
    return await fn();
  } finally {
    release!();
  }
};

export function createFaucetRoute(): Router {
  const router = Router();

  /**
   * POST /api/faucet/claim
   * Claim mock USDC + IDRX from faucet
   */
  router.post('/claim', async (req: Request, res: Response) => {
    try {
      const { address } = req.body;

      if (!address) {
        return res.status(400).json({
          success: false,
          error: 'Address is required',
          timestamp: Date.now()
        });
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid address format',
          timestamp: Date.now()
        });
      }

      await withFaucetLock(async () => {
        const addressKey = address.toLowerCase();
        const now = Date.now();
        const lastClaimAt = faucetClaims.get(addressKey);
        if (lastClaimAt && now - lastClaimAt < FAUCET_COOLDOWN_MS) {
          const remaining = FAUCET_COOLDOWN_MS - (now - lastClaimAt);
          res.status(429).json({
            success: false,
            error: `Faucet cooldown active. Please try again in ${formatCooldown(remaining)}.`,
            cooldownRemainingMs: remaining,
            nextClaimAt: lastClaimAt + FAUCET_COOLDOWN_MS,
            timestamp: now
          });
          return;
        }

        // Get configuration from environment
        const usdcAddress = process.env.USDC_TOKEN_ADDRESS;
        const idrxAddress = process.env.IDRX_TOKEN_ADDRESS;
        const faucetPrivateKey = process.env.RELAY_PRIVATE_KEY || process.env.FAUCET_PRIVATE_KEY;
        const rpcUrl =
          process.env.RPC_URL ||
          process.env.NEXT_PUBLIC_RPC_URL ||
          'https://sepolia.base.org';

        if (!faucetPrivateKey) {
          logger.error('RELAY_PRIVATE_KEY/FAUCET_PRIVATE_KEY not configured in environment');
          res.status(500).json({
            success: false,
            error: 'Faucet not configured. Please contact administrator.',
            timestamp: Date.now()
          });
          return;
        }

        if (!usdcAddress || !/^0x[a-fA-F0-9]{40}$/.test(usdcAddress)) {
          res.status(500).json({
            success: false,
            error: 'USDC token address not configured.',
            timestamp: Date.now()
          });
          return;
        }

        if (!idrxAddress || !/^0x[a-fA-F0-9]{40}$/.test(idrxAddress)) {
          res.status(500).json({
            success: false,
            error: 'IDRX token address not configured.',
            timestamp: Date.now()
          });
          return;
        }

        // Create account from private key
        const account = privateKeyToAccount(faucetPrivateKey as `0x${string}`);

        // Create wallet client
        const walletClient = createWalletClient({
          account,
          chain: baseSepolia,
          transport: http(rpcUrl),
        });

        // Create public client for waiting transaction
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(rpcUrl),
        });

        // Parse amounts (USDC/IDRX have 6 decimals)
        const usdcAmount = parseUnits(USDC_FAUCET_AMOUNT, 6);
        const idrxAmount = parseUnits(IDRX_FAUCET_AMOUNT, 6);

        logger.info(`Minting ${USDC_FAUCET_AMOUNT} USDC + ${IDRX_FAUCET_AMOUNT} IDRX to ${address}...`);

        const baseNonce = await publicClient.getTransactionCount({
          address: account.address,
          blockTag: 'pending',
        });

        // Mint USDC
        const usdcHash = await walletClient.writeContract({
          address: usdcAddress as `0x${string}`,
          abi: MOCK_ERC20_ABI,
          functionName: 'mint',
          args: [address as `0x${string}`, usdcAmount],
          nonce: baseNonce,
        });

        logger.info(`USDC transaction submitted: ${usdcHash}`);

        const usdcReceipt = await publicClient.waitForTransactionReceipt({
          hash: usdcHash,
          confirmations: 1
        });
        if (!isReceiptSuccess(usdcReceipt.status)) {
          logger.error('USDC mint reverted', { txHash: usdcHash, status: usdcReceipt.status });
          throw new Error(`USDC mint reverted: ${usdcHash}`);
        }

        // Mint IDRX
        const idrxHash = await walletClient.writeContract({
          address: idrxAddress as `0x${string}`,
          abi: MOCK_ERC20_ABI,
          functionName: 'mint',
          args: [address as `0x${string}`, idrxAmount],
          nonce: baseNonce + 1,
        });

        logger.info(`IDRX transaction submitted: ${idrxHash}`);

        const idrxReceipt = await publicClient.waitForTransactionReceipt({
          hash: idrxHash,
          confirmations: 1
        });
        if (!isReceiptSuccess(idrxReceipt.status)) {
          logger.error('IDRX mint reverted', { txHash: idrxHash, status: idrxReceipt.status });
          throw new Error(`IDRX mint reverted: ${idrxHash}`);
        }

        faucetClaims.set(addressKey, now);

        logger.success(`Successfully minted ${USDC_FAUCET_AMOUNT} USDC + ${IDRX_FAUCET_AMOUNT} IDRX to ${address}`);

        res.json({
          success: true,
          data: {
            usdcTransactionHash: usdcHash,
            idrxTransactionHash: idrxHash,
            usdcAmount: USDC_FAUCET_AMOUNT,
            idrxAmount: IDRX_FAUCET_AMOUNT,
            recipient: address,
            usdcStatus: usdcReceipt.status,
            idrxStatus: idrxReceipt.status,
            usdcBlockNumber: usdcReceipt.blockNumber.toString(),
            idrxBlockNumber: idrxReceipt.blockNumber.toString(),
            explorerUrls: [
              `https://sepolia.basescan.org/tx/${usdcHash}`,
              `https://sepolia.basescan.org/tx/${idrxHash}`
            ]
          },
          message: `Successfully claimed ${USDC_FAUCET_AMOUNT} USDC + ${IDRX_FAUCET_AMOUNT} IDRX`,
          timestamp: now
        });
      });

    } catch (error: any) {
      logger.error('Error claiming from faucet:', error);

      let errorMessage = 'Failed to claim faucet rewards';

      if (error?.message?.includes('mint')) {
        errorMessage = 'This contract does not support minting. Please use a different faucet.';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMessage = 'Faucet has insufficient funds. Please contact administrator.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      return res.status(500).json({
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      });
    }
  });

  /**
   * GET /api/faucet/status
   * Get faucet status and configuration
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      const faucetPrivateKey = process.env.RELAY_PRIVATE_KEY || process.env.FAUCET_PRIVATE_KEY;

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

      const account = privateKeyToAccount(faucetPrivateKey as `0x${string}`);
      const rpcUrl =
        process.env.RPC_URL ||
        process.env.NEXT_PUBLIC_RPC_URL ||
        'https://sepolia.base.org';

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(rpcUrl),
      });

      // Get faucet ETH balance
      const balance = await publicClient.getBalance({
        address: account.address,
      });

      return res.json({
        success: true,
        data: {
          enabled: true,
          faucetAddress: account.address,
          ethBalance: (Number(balance) / 1e18).toFixed(6),
          defaultAmounts: {
            usdc: USDC_FAUCET_AMOUNT,
            idrx: IDRX_FAUCET_AMOUNT
          },
          cooldownHours: 24,
          network: 'Base Sepolia',
          chainId: 84532
        },
        timestamp: Date.now()
      });

    } catch (error: any) {
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
