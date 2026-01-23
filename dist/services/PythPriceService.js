"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythPriceService = void 0;
const ws_1 = __importDefault(require("ws"));
const Logger_1 = require("../utils/Logger");
const types_1 = require("../types");
class PythPriceService {
    constructor() {
        this.currentPrices = {};
        this.priceUpdateCallbacks = [];
        this.pythWs = null;
        this.PYTH_HERMES_WS = 'wss://hermes.pyth.network/ws';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.logger = new Logger_1.Logger('PythPriceService');
    }
    async initialize() {
        this.logger.info('🚀 Initializing Pyth Price Service...');
        this.logger.info(`📊 Monitoring ${types_1.SUPPORTED_ASSETS.length} assets via Pyth Network`);
        this.logger.info(`📡 Connecting to: ${this.PYTH_HERMES_WS}`);
        this.connectPythWebSocket();
        this.logger.success('✅ Pyth Price Service initialized successfully');
    }
    connectPythWebSocket() {
        try {
            this.logger.info('🔗 Connecting to Pyth WebSocket...');
            this.pythWs = new ws_1.default(this.PYTH_HERMES_WS);
            this.pythWs.on('open', () => {
                this.logger.success('✅ Pyth WebSocket connected');
                this.reconnectAttempts = 0;
                const priceIds = types_1.SUPPORTED_ASSETS.map(asset => asset.pythPriceId);
                const subscribeMessage = {
                    type: 'subscribe',
                    ids: priceIds
                };
                this.pythWs.send(JSON.stringify(subscribeMessage));
                this.logger.info(`📡 Subscribed to ${types_1.SUPPORTED_ASSETS.length} price feeds`);
            });
            this.pythWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.type === 'price_update') {
                        this.processPriceUpdate(message);
                    }
                    else if (message.type === 'response') {
                        if (message.status === 'error') {
                            this.logger.error(`❌ Pyth subscription error: ${message.error}`);
                        }
                        else {
                            this.logger.debug(`📬 Subscription response: ${JSON.stringify(message)}`);
                        }
                    }
                }
                catch (error) {
                    this.logger.error('Error parsing Pyth message:', error);
                }
            });
            this.pythWs.on('error', (error) => {
                this.logger.error('❌ Pyth WebSocket error:', error);
            });
            this.pythWs.on('close', () => {
                this.logger.warn('🔌 Pyth WebSocket disconnected');
                this.attemptReconnect();
            });
        }
        catch (error) {
            this.logger.error('Failed to connect to Pyth WebSocket:', error);
            this.attemptReconnect();
        }
    }
    processPriceUpdate(message) {
        try {
            const priceFeed = message.price_feed;
            if (!priceFeed || !priceFeed.price) {
                return;
            }
            const feedIdWithPrefix = priceFeed.id.startsWith('0x') ? priceFeed.id : `0x${priceFeed.id}`;
            const asset = types_1.SUPPORTED_ASSETS.find(a => a.pythPriceId.toLowerCase() === feedIdWithPrefix.toLowerCase());
            if (!asset) {
                return;
            }
            const priceData = priceFeed.price;
            const priceRaw = parseFloat(priceData.price);
            const expo = priceData.expo;
            const confidenceRaw = parseFloat(priceData.conf);
            const publishTime = parseInt(priceData.publish_time) * 1000;
            const price = priceRaw * Math.pow(10, expo);
            const confidence = confidenceRaw * Math.pow(10, expo);
            const now = Date.now();
            const age = now - publishTime;
            if (age > 60000) {
                this.logger.debug(`⚠️ Stale data for ${asset.symbol} (${age}ms old), skipping...`);
                return;
            }
            this.currentPrices[asset.symbol] = {
                symbol: asset.symbol,
                price: price,
                confidence: confidence,
                expo: expo,
                timestamp: publishTime,
                source: 'pyth',
                publishTime: publishTime
            };
            if (Math.random() < 0.01) {
                const confidencePercent = (confidence / price) * 100;
                this.logger.info(`📊 ${asset.symbol}: $${price.toFixed(2)} (±${confidencePercent.toFixed(4)}%)`);
            }
            this.notifyPriceUpdate();
        }
        catch (error) {
            this.logger.error('Error processing price update:', error);
        }
    }
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error(`❌ Max reconnect attempts (${this.maxReconnectAttempts}) reached`);
            return;
        }
        this.reconnectAttempts++;
        const delay = 5000 * this.reconnectAttempts;
        this.logger.info(`♻️ Attempting to reconnect in ${delay / 1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
            this.connectPythWebSocket();
        }, delay);
    }
    notifyPriceUpdate() {
        this.priceUpdateCallbacks.forEach(callback => {
            try {
                callback(this.currentPrices);
            }
            catch (error) {
                this.logger.error('Error in price update callback:', error);
            }
        });
    }
    getCurrentPrices() {
        return { ...this.currentPrices };
    }
    getCurrentPrice(symbol) {
        return this.currentPrices[symbol] || null;
    }
    onPriceUpdate(callback) {
        this.priceUpdateCallbacks.push(callback);
    }
    removePriceUpdateCallback(callback) {
        const index = this.priceUpdateCallbacks.indexOf(callback);
        if (index > -1) {
            this.priceUpdateCallbacks.splice(index, 1);
        }
    }
    getHealthStatus() {
        const prices = Object.values(this.currentPrices);
        if (prices.length === 0) {
            return {
                status: 'disconnected',
                lastUpdate: 0,
                assetsMonitored: 0
            };
        }
        const latestUpdate = Math.max(...prices.map(p => p.timestamp));
        const timeSinceLastUpdate = Date.now() - latestUpdate;
        const isHealthy = timeSinceLastUpdate < 30000;
        return {
            status: isHealthy ? 'connected' : 'stale',
            lastUpdate: latestUpdate,
            assetsMonitored: prices.length
        };
    }
    async shutdown() {
        this.logger.info('Shutting down Pyth Price Service...');
        if (this.pythWs) {
            this.pythWs.close();
            this.pythWs = null;
        }
        this.priceUpdateCallbacks = [];
        this.currentPrices = {};
        this.logger.success('✅ Pyth Price Service shut down successfully');
    }
}
exports.PythPriceService = PythPriceService;
//# sourceMappingURL=PythPriceService.js.map