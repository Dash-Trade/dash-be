"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionKeyValidator = void 0;
const ethers_1 = require("ethers");
const Logger_1 = require("../utils/Logger");
class SessionKeyValidator {
    constructor() {
        this.logger = new Logger_1.Logger('SessionKeyValidator');
    }
    validateOrderWithSession(params) {
        try {
            const { trader, symbol, isLong, collateral, leverage, nonce, signature, marketExecutor, sessionKey } = params;
            const now = Date.now();
            if (sessionKey.expiresAt <= now) {
                return { valid: false, error: 'Session expired' };
            }
            if (sessionKey.authorizedBy.toLowerCase() !== trader.toLowerCase()) {
                return { valid: false, error: 'Session not authorized by trader' };
            }
            const expiresAtSeconds = Math.floor(sessionKey.expiresAt / 1000);
            const authMessageHash = ethers_1.ethers.solidityPackedKeccak256(['string', 'address', 'string', 'uint256'], [
                'Authorize session key ',
                sessionKey.address,
                ' for Tethra Tap-to-Trade until ',
                expiresAtSeconds
            ]);
            const authDigest = ethers_1.ethers.hashMessage(ethers_1.ethers.getBytes(authMessageHash));
            const recoveredAuthSigner = ethers_1.ethers.recoverAddress(authDigest, sessionKey.authSignature);
            if (recoveredAuthSigner.toLowerCase() !== trader.toLowerCase()) {
                this.logger.error('Session auth signature invalid', {
                    expected: trader,
                    recovered: recoveredAuthSigner,
                    sessionKeyAddress: sessionKey.address,
                    expiresAtSeconds,
                    authMessageHash,
                    authDigest,
                });
                return { valid: false, error: 'Invalid session authorization signature' };
            }
            this.logger.info('🔍 Computing message hash with parameters:', {
                trader,
                symbol,
                isLong,
                collateral,
                leverage,
                nonce,
                marketExecutor,
            });
            const messageHash = ethers_1.ethers.solidityPackedKeccak256(['address', 'string', 'bool', 'uint256', 'uint256', 'uint256', 'address'], [trader, symbol, isLong, collateral, leverage, nonce, marketExecutor]);
            this.logger.info('📝 Message hash computed:', messageHash);
            this.logger.info('✍️ Signature to verify:', signature);
            const digest = ethers_1.ethers.hashMessage(ethers_1.ethers.getBytes(messageHash));
            const recoveredSigner = ethers_1.ethers.recoverAddress(digest, signature);
            this.logger.info('🔍 Signature verification details:', {
                messageHash,
                digest,
                recoveredSigner,
                expectedSessionKey: sessionKey.address,
            });
            if (recoveredSigner.toLowerCase() !== sessionKey.address.toLowerCase()) {
                this.logger.error('Order signature not from session key', {
                    expected: sessionKey.address,
                    recovered: recoveredSigner,
                    messageHash,
                    digest,
                });
                return { valid: false, error: 'Order signature not from session key' };
            }
            this.logger.info('✅ Session key validation successful', {
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
    validateOrderWithoutSession(params) {
        try {
            const { trader, symbol, isLong, collateral, leverage, nonce, signature, marketExecutor } = params;
            const messageHash = ethers_1.ethers.solidityPackedKeccak256(['address', 'string', 'bool', 'uint256', 'uint256', 'uint256', 'address'], [trader, symbol, isLong, collateral, leverage, nonce, marketExecutor]);
            const digest = ethers_1.ethers.hashMessage(ethers_1.ethers.getBytes(messageHash));
            const recoveredSigner = ethers_1.ethers.recoverAddress(digest, signature);
            if (recoveredSigner.toLowerCase() !== trader.toLowerCase()) {
                this.logger.error('Order signature invalid', {
                    expected: trader,
                    recovered: recoveredSigner,
                    messageHash,
                    digest,
                });
                return { valid: false, error: 'Invalid order signature' };
            }
            this.logger.info('✅ Traditional order validation successful', { trader });
            return { valid: true };
        }
        catch (err) {
            this.logger.error('Order validation error:', err);
            return { valid: false, error: err.message || 'Order validation failed' };
        }
    }
}
exports.SessionKeyValidator = SessionKeyValidator;
//# sourceMappingURL=SessionKeyValidator.js.map