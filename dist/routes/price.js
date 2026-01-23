"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPriceRoute = createPriceRoute;
const express_1 = require("express");
function createPriceRoute(priceService, signerService) {
    const router = (0, express_1.Router)();
    router.get('/all', (req, res) => {
        try {
            const currentPrices = priceService.getCurrentPrices();
            if (Object.keys(currentPrices).length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No price data available',
                    timestamp: Date.now()
                });
            }
            res.json({
                success: true,
                data: currentPrices,
                count: Object.keys(currentPrices).length,
                timestamp: Date.now()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get prices',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.get('/current/:symbol', (req, res) => {
        try {
            const symbol = req.params.symbol.toUpperCase();
            const currentPrice = priceService.getCurrentPrice(symbol);
            if (!currentPrice) {
                return res.status(404).json({
                    success: false,
                    error: `No price data available for ${symbol}`,
                    timestamp: Date.now()
                });
            }
            res.json({
                success: true,
                data: currentPrice,
                timestamp: Date.now()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get price',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.get('/health', (req, res) => {
        try {
            const healthStatus = priceService.getHealthStatus();
            res.json({
                success: true,
                data: healthStatus,
                timestamp: Date.now()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get price service health',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.get('/signed/:symbol', async (req, res) => {
        try {
            const symbol = req.params.symbol.toUpperCase();
            if (!signerService.isInitialized()) {
                return res.status(503).json({
                    success: false,
                    error: 'Price Signer not initialized',
                    message: 'Please configure PRICE_SIGNER_PRIVATE_KEY in environment',
                    timestamp: Date.now()
                });
            }
            const currentPrice = priceService.getCurrentPrice(symbol);
            if (!currentPrice) {
                return res.status(404).json({
                    success: false,
                    error: `No price data available for ${symbol}`,
                    timestamp: Date.now()
                });
            }
            const priceInDecimals = BigInt(Math.floor(currentPrice.price * 1e8));
            const timestamp = Math.floor(Date.now() / 1000) - 2;
            const signedData = await signerService.signPrice(symbol, priceInDecimals, timestamp);
            res.json({
                success: true,
                data: {
                    symbol: symbol,
                    ...signedData,
                    priceUSD: currentPrice.price,
                    confidence: currentPrice.confidence,
                    validUntil: timestamp + 300
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to sign price',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.post('/verify', (req, res) => {
        try {
            const { symbol, price, timestamp, signature } = req.body;
            if (!symbol || !price || !timestamp || !signature) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields',
                    required: ['symbol', 'price', 'timestamp', 'signature'],
                    timestamp: Date.now()
                });
            }
            const recoveredAddress = signerService.verifySignature(symbol, price, timestamp, signature);
            const expectedAddress = signerService.getSignerAddress();
            const isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
            res.json({
                success: true,
                data: {
                    isValid,
                    recoveredAddress,
                    expectedAddress,
                    match: isValid
                },
                timestamp: Date.now()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to verify signature',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    router.get('/signer/status', (req, res) => {
        try {
            const status = signerService.getStatus();
            res.json({
                success: true,
                data: status,
                timestamp: Date.now()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get signer status',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now()
            });
        }
    });
    return router;
}
//# sourceMappingURL=price.js.map