"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneTapProfitSessionValidator = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
class OneTapProfitSessionValidator {
    constructor() {
        this.logger = new Logger_1.Logger('OneTapProfitSessionValidator');
    }
    validateBetWithSession(params) {
        try {
            const { trader, symbol, betAmount, targetPrice, targetTime, nonce, signature, contractAddress, sessionKey } = params;
            const now = Date.now();
            if (sessionKey.expiresAt <= now) {
                return { valid: false, error: 'Session expired' };
            }
            if (sessionKey.authorizedBy.toLowerCase() !== trader.toLowerCase()) {
                return { valid: false, error: 'Session not authorized by trader' };
            }
            const expiresAtSeconds = Math.floor(sessionKey.expiresAt / 1000);
            const authMessage = `Authorize session key ${sessionKey.address} for Tethra Tap-to-Trade until ${expiresAtSeconds}`;
            const authMessageHash = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(authMessage));
            const recoveredAuthSigner = ethers_1.ethers.verifyMessage(ethers_1.ethers.getBytes(authMessageHash), sessionKey.authSignature);
            if (recoveredAuthSigner.toLowerCase() !== trader.toLowerCase()) {
                this.logger.error('Session auth signature invalid', {
                    expected: trader,
                    recovered: recoveredAuthSigner,
                    authMessage,
                });
                return { valid: false, error: 'Invalid session authorization signature' };
            }
            this.logger.info('🔍 Computing message hash for OneTapProfit with parameters:', {
                trader,
                symbol,
                betAmount,
                targetPrice,
                targetTime,
                nonce,
                contractAddress,
            });
            const messageHash = ethers_1.ethers.solidityPackedKeccak256(['address', 'string', 'uint256', 'uint256', 'uint256', 'uint256', 'address'], [
                trader,
                symbol,
                betAmount,
                targetPrice,
                targetTime,
                nonce,
                contractAddress
            ]);
            this.logger.info('📝 Message hash computed:', messageHash);
            this.logger.info('✍️ Signature to verify:', signature);
            const recoveredSigner = ethers_1.ethers.verifyMessage(ethers_1.ethers.getBytes(messageHash), signature);
            if (recoveredSigner.toLowerCase() !== sessionKey.address.toLowerCase()) {
                this.logger.error('Bet signature not from session key', {
                    expected: sessionKey.address,
                    recovered: recoveredSigner,
                    messageHash,
                });
                return { valid: false, error: 'Bet signature not from session key' };
            }
            this.logger.info('✅ OneTapProfit session key validation successful', {
                trader,
                sessionKey: sessionKey.address,
                expiresIn: Math.round((sessionKey.expiresAt - now) / 1000 / 60) + ' minutes',
            });
            return { valid: true };
        }
        catch (err) {
            this.logger.error('Session validation error:', err);
            return { valid: false, error: err.message || 'Session validation failed' };
        }
    }
    validateBetWithoutSession(params) {
        try {
            const { trader, symbol, betAmount, targetPrice, targetTime, nonce, signature, contractAddress } = params;
            const messageHash = ethers_1.ethers.solidityPackedKeccak256(['address', 'string', 'uint256', 'uint256', 'uint256', 'uint256', 'address'], [trader, symbol, betAmount, targetPrice, targetTime, nonce, contractAddress]);
            const recoveredSigner = ethers_1.ethers.verifyMessage(ethers_1.ethers.getBytes(messageHash), signature);
            if (recoveredSigner.toLowerCase() !== trader.toLowerCase()) {
                this.logger.error('Bet signature invalid', {
                    expected: trader,
                    recovered: recoveredSigner,
                    messageHash,
                });
                return { valid: false, error: 'Invalid bet signature' };
            }
            this.logger.info('✅ Traditional OneTapProfit bet validation successful', { trader });
            return { valid: true };
        }
        catch (err) {
            this.logger.error('Bet validation error:', err);
            return { valid: false, error: err.message || 'Bet validation failed' };
        }
    }
}
exports.OneTapProfitSessionValidator = OneTapProfitSessionValidator;
//# sourceMappingURL=OneTapProfitSessionValidator.js.map