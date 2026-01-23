"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayService = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
const config_1 = require("../config");
class RelayService {
    constructor() {
        this.logger = new Logger_1.Logger('RelayService');
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.RPC_URL);
        this.relayWallet = new ethers_1.ethers.Wallet(config_1.config.RELAY_PRIVATE_KEY, this.provider);
        this.PAYMASTER_ADDRESS = config_1.config.USDC_PAYMASTER_ADDRESS;
        this.MARKET_EXECUTOR_ADDRESS = config_1.config.MARKET_EXECUTOR_ADDRESS;
        this.LIMIT_EXECUTOR_ADDRESS = config_1.config.LIMIT_EXECUTOR_ADDRESS;
        this.POSITION_MANAGER_ADDRESS = config_1.config.POSITION_MANAGER_ADDRESS;
        this.TREASURY_MANAGER_ADDRESS = config_1.config.TREASURY_MANAGER_ADDRESS;
        const paymasterABI = [
            'function validateGasPayment(address user, uint256 estimatedGas) view returns (bool)',
            'function processGasPayment(address user, uint256 gasUsed) returns (uint256)',
            'function userDeposits(address) view returns (uint256)',
            'function calculateUsdcCost(uint256 gasAmount) view returns (uint256)'
        ];
        this.paymasterContract = new ethers_1.Contract(this.PAYMASTER_ADDRESS, paymasterABI, this.relayWallet);
        this.logger.info('🔄 Relay Service initialized');
        this.logger.info(`   Relay Wallet: ${this.relayWallet.address}`);
    }
    async canUserPayGas(userAddress, estimatedGas) {
        try {
            const canPay = await this.paymasterContract.validateGasPayment(userAddress, estimatedGas);
            return canPay;
        }
        catch (error) {
            this.logger.error('Error checking gas payment:', error);
            return false;
        }
    }
    async getUserDeposit(userAddress) {
        try {
            const deposit = await this.paymasterContract.userDeposits(userAddress);
            return deposit;
        }
        catch (error) {
            this.logger.error('Error getting user deposit:', error);
            return 0n;
        }
    }
    async calculateGasCost(estimatedGas) {
        try {
            const usdcCost = await this.paymasterContract.calculateUsdcCost(estimatedGas);
            return usdcCost;
        }
        catch (error) {
            this.logger.warn('⚠️  Paymaster unavailable, using fallback gas calculation');
            const gasPriceWei = 1000000n;
            const gasCostWei = estimatedGas * gasPriceWei;
            const usdcCost = (gasCostWei * 3000n) / 1000000000000n;
            const minCost = 10000n;
            return usdcCost > minCost ? usdcCost : minCost;
        }
    }
    async relayTransaction(to, data, userAddress, value = 0n) {
        try {
            this.logger.info(`🔄 Relaying meta-transaction for ${userAddress}`);
            this.logger.info(`   Relayer: ${this.relayWallet.address}`);
            this.logger.info(`   Target: ${to}`);
            const gasEstimate = await this.provider.estimateGas({
                from: this.relayWallet.address,
                to,
                data,
                value
            });
            this.logger.info(`⛽ Estimated gas: ${gasEstimate.toString()}`);
            const canPay = await this.canUserPayGas(userAddress, gasEstimate);
            if (!canPay) {
                throw new Error('User has insufficient USDC deposit for gas');
            }
            const usdcCost = await this.calculateGasCost(gasEstimate);
            this.logger.info(`💵 USDC cost for user: ${usdcCost.toString()}`);
            const tx = await this.relayWallet.sendTransaction({
                to,
                data,
                value,
                gasLimit: gasEstimate * 120n / 100n
            });
            this.logger.info(`📤 Meta-transaction sent: ${tx.hash}`);
            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }
            this.logger.info(`✅ Meta-transaction confirmed: ${receipt.hash}`);
            this.logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            this.logger.info(`   Gas price: ${receipt.gasPrice?.toString() || 'N/A'}`);
            let positionId;
            try {
                const positionOpenedTopic = ethers_1.ethers.id('PositionOpened(uint256,address,string,bool,uint256,uint256,uint256,uint256)');
                this.logger.info(`🔍 Looking for PositionOpened event...`);
                this.logger.info(`   Expected topic: ${positionOpenedTopic}`);
                this.logger.info(`   Total logs: ${receipt.logs.length}`);
                for (const log of receipt.logs) {
                    this.logger.info(`   Log from: ${log.address}, topic[0]: ${log.topics[0]}`);
                    if (log.address.toLowerCase() === this.POSITION_MANAGER_ADDRESS.toLowerCase() &&
                        log.topics[0] === positionOpenedTopic) {
                        if (log.topics.length > 1) {
                            positionId = parseInt(log.topics[1], 16);
                            this.logger.info(`🎯 Extracted position ID from event: ${positionId}`);
                            break;
                        }
                        else {
                            this.logger.warn('⚠️ Found PositionOpened event but no indexed positionId');
                        }
                    }
                }
                if (!positionId) {
                    this.logger.warn('⚠️ No PositionOpened event found in receipt');
                }
            }
            catch (err) {
                this.logger.warn('⚠️ Could not extract position ID from receipt:', err);
            }
            const gasUsed = receipt.gasUsed;
            this.logger.info(`💰 Gas cost: ${usdcCost.toString()} USDC (not charged - paymaster disabled for now)`);
            return {
                txHash: receipt.hash,
                gasUsed,
                usdcCharged: usdcCost,
                positionId
            };
        }
        catch (error) {
            this.logger.error('Error relaying meta-transaction:', error);
            throw error;
        }
    }
    async closePositionGasless(userAddress, positionId, symbol) {
        try {
            this.logger.info(`🔥 GASLESS CLOSE: Position ${positionId} for ${userAddress}`);
            const priceResponse = await fetch(`${config_1.config.BACKEND_URL}/api/price/signed/${symbol}`);
            if (!priceResponse.ok) {
                throw new Error(`Failed to get price for ${symbol}`);
            }
            const priceData = await priceResponse.json();
            const signedPrice = priceData.data;
            this.logger.info(`   🔥 CALLING POSITIONMANAGER DIRECTLY (with fee split!)`);
            const positionIface = new ethers_1.ethers.Interface([
                'function getPosition(uint256) view returns (tuple(uint256 id, address trader, string symbol, bool isLong, uint256 collateral, uint256 size, uint256 leverage, uint256 entryPrice, uint256 openTimestamp, uint8 status))',
                'function calculatePnL(uint256, uint256) view returns (int256)'
            ]);
            const positionContract = new ethers_1.Contract(this.POSITION_MANAGER_ADDRESS, positionIface, this.provider);
            const positionData = await positionContract.getPosition(BigInt(positionId));
            const position = {
                id: positionData[0],
                trader: positionData[1],
                symbol: positionData[2],
                isLong: positionData[3],
                collateral: positionData[4],
                size: positionData[5],
                leverage: positionData[6],
                entryPrice: positionData[7],
                openTimestamp: positionData[8],
                status: positionData[9]
            };
            const pnl = await positionContract.calculatePnL(BigInt(positionId), BigInt(signedPrice.price));
            this.logger.info(`   📊 Position details:`);
            this.logger.info(`   - Collateral: ${position.collateral.toString()}`);
            this.logger.info(`   - Size: ${position.size.toString()}`);
            this.logger.info(`   - Leverage: ${position.leverage.toString()}`);
            this.logger.info(`   - PnL: ${pnl.toString()}`);
            const closeIface = new ethers_1.ethers.Interface([
                'function closePosition(uint256 positionId, uint256 exitPrice)'
            ]);
            const closeData = closeIface.encodeFunctionData('closePosition', [
                BigInt(positionId),
                BigInt(signedPrice.price)
            ]);
            const tx = await this.relayWallet.sendTransaction({
                to: this.POSITION_MANAGER_ADDRESS,
                data: closeData,
                gasLimit: 500000n
            });
            this.logger.info(`📤 Close TX sent: ${tx.hash}`);
            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }
            this.logger.success(`✅ Position ${positionId} CLOSED! TX: ${receipt.hash}`);
            this.logger.info('⏳ Waiting for nonce to update...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const TRADING_FEE_BPS = 5n;
            const tradingFee = (position.collateral * TRADING_FEE_BPS) / 10000n;
            const relayerFee = (tradingFee * 2000n) / 10000n;
            const treasuryFee = tradingFee - relayerFee;
            this.logger.info(`💰 Fee breakdown (from collateral):`);
            this.logger.info(`   Collateral: ${(Number(position.collateral) / 1e6).toFixed(6)} USDC`);
            this.logger.info(`   Total fee: ${(Number(tradingFee) / 1e6).toFixed(6)} USDC (0.05% of collateral)`);
            this.logger.info(`   Relayer fee: ${(Number(relayerFee) / 1e6).toFixed(6)} USDC (0.01% of collateral)`);
            this.logger.info(`   Treasury fee: ${(Number(treasuryFee) / 1e6).toFixed(6)} USDC (0.04% of collateral)`);
            let refundAmount;
            if (pnl >= 0) {
                refundAmount = position.collateral + BigInt(pnl) - tradingFee;
            }
            else {
                const absLoss = BigInt(-pnl);
                if (position.collateral > absLoss + tradingFee) {
                    refundAmount = position.collateral - absLoss - tradingFee;
                }
                else {
                    refundAmount = 0n;
                }
            }
            this.logger.info(`💰 Settlement:`);
            this.logger.info(`   Refund to trader: ${refundAmount.toString()}`);
            const treasuryIface = new ethers_1.ethers.Interface([
                'function refundCollateral(address to, uint256 amount)',
                'function collectFee(address from, uint256 amount)'
            ]);
            const nonce = await this.provider.getTransactionCount(this.relayWallet.address, 'pending');
            if (treasuryFee > 0n) {
                const feeData = treasuryIface.encodeFunctionData('collectFee', [
                    position.trader,
                    treasuryFee
                ]);
                const feeTx = await this.relayWallet.sendTransaction({
                    to: this.TREASURY_MANAGER_ADDRESS,
                    data: feeData,
                    gasLimit: 200000n,
                    nonce: nonce
                });
                this.logger.info(`📤 Treasury fee TX: ${feeTx.hash}`);
                await feeTx.wait();
                this.logger.success(`✅ Treasury fee collected: ${treasuryFee.toString()}`);
            }
            if (relayerFee > 0n) {
                const usdcIface = new ethers_1.ethers.Interface([
                    'function transfer(address to, uint256 amount)'
                ]);
                const relayerFeeData = usdcIface.encodeFunctionData('transfer', [
                    this.relayWallet.address,
                    relayerFee
                ]);
                const relayerFeeTx = await this.relayWallet.sendTransaction({
                    to: this.TREASURY_MANAGER_ADDRESS,
                    data: treasuryIface.encodeFunctionData('refundCollateral', [
                        this.relayWallet.address,
                        relayerFee
                    ]),
                    gasLimit: 200000n,
                    nonce: nonce + 1
                });
                this.logger.info(`📤 Relayer fee TX: ${relayerFeeTx.hash}`);
                await relayerFeeTx.wait();
                this.logger.success(`✅ Relayer fee paid: ${relayerFee.toString()}`);
            }
            if (refundAmount > 0n) {
                const refundData = treasuryIface.encodeFunctionData('refundCollateral', [
                    position.trader,
                    refundAmount
                ]);
                const refundTx = await this.relayWallet.sendTransaction({
                    to: this.TREASURY_MANAGER_ADDRESS,
                    data: refundData,
                    gasLimit: 200000n,
                    nonce: nonce + 2
                });
                this.logger.info(`📤 Refund TX: ${refundTx.hash}`);
                await refundTx.wait();
                this.logger.success(`✅ Refunded ${refundAmount.toString()} to trader!`);
            }
            return {
                txHash: receipt.hash
            };
        }
        catch (error) {
            this.logger.error('Error closing position gasless:', error);
            throw error;
        }
    }
    async cancelOrderGasless(userAddress, orderId, userSignature) {
        try {
            this.logger.info(`❌ GASLESS CANCEL: Order ${orderId} for ${userAddress}`);
            const limitExecutorContract = new ethers_1.Contract(this.LIMIT_EXECUTOR_ADDRESS, ['function getUserCurrentNonce(address) view returns (uint256)'], this.provider);
            const userNonce = await limitExecutorContract.getUserCurrentNonce(userAddress);
            this.logger.info(`   User nonce: ${userNonce.toString()}`);
            const iface = new ethers_1.ethers.Interface([
                'function cancelOrderGasless(address trader, uint256 orderId, uint256 nonce, bytes calldata userSignature)'
            ]);
            const data = iface.encodeFunctionData('cancelOrderGasless', [
                userAddress,
                BigInt(orderId),
                userNonce,
                userSignature
            ]);
            this.logger.info(`   🔥 Calling cancelOrderGasless (keeper pays gas)`);
            const tx = await this.relayWallet.sendTransaction({
                to: this.LIMIT_EXECUTOR_ADDRESS,
                data: data,
                gasLimit: 200000n
            });
            this.logger.info(`📤 Cancel TX sent: ${tx.hash}`);
            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error('Transaction receipt not found');
            }
            this.logger.success(`✅ Order ${orderId} CANCELLED! TX: ${receipt.hash}`);
            return {
                txHash: receipt.hash
            };
        }
        catch (error) {
            this.logger.error('Error cancelling order gasless:', error);
            throw error;
        }
    }
    async getRelayBalance() {
        const balance = await this.provider.getBalance(this.relayWallet.address);
        return {
            eth: balance,
            ethFormatted: ethers_1.ethers.formatEther(balance)
        };
    }
}
exports.RelayService = RelayService;
//# sourceMappingURL=RelayService.js.map