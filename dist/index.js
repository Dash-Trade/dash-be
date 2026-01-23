"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const config_1 = require("./config");
const PythPriceService_1 = require("./services/PythPriceService");
const PriceSignerService_1 = require("./services/PriceSignerService");
const RelayService_1 = require("./services/RelayService");
const LimitOrderService_1 = require("./services/LimitOrderService");
const LimitOrderExecutor_1 = require("./services/LimitOrderExecutor");
const PositionMonitor_1 = require("./services/PositionMonitor");
const GridTradingService_1 = require("./services/GridTradingService");
const TPSLMonitor_1 = require("./services/TPSLMonitor");
const TapToTradeService_1 = require("./services/TapToTradeService");
const TapToTradeExecutor_1 = require("./services/TapToTradeExecutor");
const OneTapProfitService_1 = require("./services/OneTapProfitService");
const OneTapProfitMonitor_1 = require("./services/OneTapProfitMonitor");
const price_1 = require("./routes/price");
const relay_1 = require("./routes/relay");
const limitOrders_1 = require("./routes/limitOrders");
const gridTrading_1 = require("./routes/gridTrading");
const tpsl_1 = require("./routes/tpsl");
const tapToTrade_1 = require("./routes/tapToTrade");
const oneTapProfit_1 = require("./routes/oneTapProfit");
const faucet_1 = require("./routes/faucet");
const Logger_1 = require("./utils/Logger");
dotenv_1.default.config();
const logger = new Logger_1.Logger('Main');
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});
async function main() {
    try {
        logger.info('🚀 Starting Tethra DEX Backend (Pyth Oracle Integration)...');
        const priceService = new PythPriceService_1.PythPriceService();
        const signerService = new PriceSignerService_1.PriceSignerService();
        const relayService = new RelayService_1.RelayService();
        const limitOrderService = new LimitOrderService_1.LimitOrderService();
        const gridTradingService = new GridTradingService_1.GridTradingService();
        const tapToTradeService = new TapToTradeService_1.TapToTradeService();
        const oneTapProfitService = new OneTapProfitService_1.OneTapProfitService();
        await priceService.initialize();
        logger.info('🎯 Initializing TP/SL Monitor...');
        const tpslMonitor = new TPSLMonitor_1.TPSLMonitor(priceService);
        tpslMonitor.start();
        tpslMonitorRef = tpslMonitor;
        logger.success('✅ TP/SL Monitor started! Ready to execute TP/SL orders...');
        logger.info('🤖 Initializing Limit Order Executor...');
        const limitOrderExecutor = new LimitOrderExecutor_1.LimitOrderExecutor(priceService, gridTradingService, tpslMonitor, limitOrderService);
        limitOrderExecutor.start();
        limitOrderExecutorRef = limitOrderExecutor;
        logger.success('✅ Limit Order Executor started! Monitoring for orders...');
        logger.info('🎯 Initializing Tap-to-Trade Executor...');
        const tapToTradeExecutor = new TapToTradeExecutor_1.TapToTradeExecutor(priceService, tapToTradeService);
        tapToTradeExecutor.start();
        tapToTradeExecutorRef = tapToTradeExecutor;
        logger.success('✅ Tap-to-Trade Executor started! Monitoring for tap-to-trade orders...');
        logger.info('🎰 Initializing One Tap Profit Monitor...');
        const oneTapProfitMonitor = new OneTapProfitMonitor_1.OneTapProfitMonitor(priceService, oneTapProfitService);
        oneTapProfitMonitor.start();
        oneTapProfitMonitorRef = oneTapProfitMonitor;
        logger.success('✅ One Tap Profit Monitor started! Monitoring for bets...');
        logger.info('🔍 Initializing Position Monitor (Auto-Liquidation)...');
        const positionMonitor = new PositionMonitor_1.PositionMonitor(priceService);
        positionMonitor.start();
        positionMonitorRef = positionMonitor;
        logger.success('✅ Position Monitor started! Monitoring for liquidations...');
        if (signerService.isInitialized()) {
            logger.success(`✅ Price Signer ready: ${signerService.getSignerAddress()}`);
        }
        else {
            logger.warn('⚠️  Price Signer not available (signed price endpoints disabled)');
        }
        const relayBalance = await relayService.getRelayBalance();
        logger.success(`✅ Relay Service ready: ${relayBalance.ethFormatted} ETH`);
        if (parseFloat(relayBalance.ethFormatted) < 0.01) {
            logger.warn('⚠️  Relay wallet has low ETH balance! Please fund for gasless transactions.');
        }
        const server = http_1.default.createServer(app);
        const wss = new ws_1.Server({ server, path: '/ws/price' });
        logger.info('📡 WebSocket server initialized on /ws/price');
        wss.on('connection', (ws) => {
            logger.info('✅ New WebSocket client connected');
            const currentPrices = priceService.getCurrentPrices();
            if (Object.keys(currentPrices).length > 0) {
                ws.send(JSON.stringify({
                    type: 'price_update',
                    data: currentPrices,
                    timestamp: Date.now()
                }));
            }
            ws.on('error', (error) => {
                logger.error('WebSocket client error:', error);
            });
            ws.on('close', () => {
                logger.info('❌ WebSocket client disconnected');
            });
        });
        priceService.onPriceUpdate((prices) => {
            const message = JSON.stringify({
                type: 'price_update',
                data: prices,
                timestamp: Date.now()
            });
            wss.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.send(message);
                }
            });
        });
        app.get('/', (req, res) => {
            res.json({
                success: true,
                message: 'Tethra DEX Backend - Pyth Oracle Price Service',
                version: '1.0.0',
                endpoints: {
                    websocket: '/ws/price',
                    prices: '/api/price',
                    signedPrices: '/api/price/signed/:symbol',
                    verifySignature: '/api/price/verify',
                    signerStatus: '/api/price/signer/status',
                    relay: '/api/relay',
                    relayTransaction: '/api/relay/transaction',
                    relayBalance: '/api/relay/balance/:address',
                    relayStatus: '/api/relay/status',
                    limitOrderCreate: '/api/limit-orders/create',
                    gridTradingCreateSession: '/api/grid/create-session',
                    gridTradingPlaceOrders: '/api/grid/place-orders',
                    gridTradingUserGrids: '/api/grid/user/:trader',
                    gridTradingStats: '/api/grid/stats',
                    tpslSet: '/api/tpsl/set',
                    tpslGet: '/api/tpsl/:positionId',
                    tpslGetAll: '/api/tpsl/all',
                    tpslDelete: '/api/tpsl/:positionId',
                    tpslStatus: '/api/tpsl/status',
                    tapToTradeCreateOrder: '/api/tap-to-trade/create-order',
                    tapTotradeBatchCreate: '/api/tap-to-trade/batch-create',
                    tapToTradeOrders: '/api/tap-to-trade/orders',
                    tapTotradePending: '/api/tap-to-trade/pending',
                    tapTotradeCancelOrder: '/api/tap-to-trade/cancel-order',
                    tapToTradeStats: '/api/tap-to-trade/stats',
                    oneTapPlaceBet: '/api/one-tap/place-bet',
                    oneTapBets: '/api/one-tap/bets',
                    oneTapActive: '/api/one-tap/active',
                    oneTapCalculateMultiplier: '/api/one-tap/calculate-multiplier',
                    oneTapStats: '/api/one-tap/stats',
                    oneTapStatus: '/api/one-tap/status',
                    faucetClaim: '/api/faucet/claim',
                    faucetStatus: '/api/faucet/status',
                    health: '/health'
                },
                timestamp: Date.now()
            });
        });
        app.get('/health', (_req, res) => {
            const healthStatus = priceService.getHealthStatus();
            res.json({
                success: true,
                service: 'Tethra DEX Backend',
                uptime: process.uptime(),
                priceService: healthStatus,
                timestamp: Date.now()
            });
        });
        app.use('/api/price', (0, price_1.createPriceRoute)(priceService, signerService));
        app.use('/api/relay', (0, relay_1.createRelayRoute)(relayService));
        app.use('/api/limit-orders', (0, limitOrders_1.createLimitOrderRoute)(limitOrderService));
        app.use('/api/grid', (0, gridTrading_1.createGridTradingRoute)(gridTradingService));
        app.use('/api/tpsl', (0, tpsl_1.createTPSLRoute)(tpslMonitor));
        app.use('/api/tap-to-trade', (0, tapToTrade_1.createTapToTradeRoute)(tapToTradeService));
        app.use('/api/one-tap', (0, oneTapProfit_1.createOneTapProfitRoute)(oneTapProfitService, oneTapProfitMonitor));
        app.use('/api/faucet', (0, faucet_1.createFaucetRoute)());
        const sessionRoutes = require('./routes/sessionRoutes').default;
        app.use('/api/session', sessionRoutes);
        app.use((error, _req, res, _next) => {
            logger.error('Unhandled API error:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
                timestamp: Date.now()
            });
        });
        app.use((req, res) => {
            res.status(404).json({
                error: 'Not found',
                message: `Route ${req.method} ${req.path} not found`,
                timestamp: Date.now()
            });
        });
        server.listen(config_1.config.PORT, () => {
            logger.success(`🎉 Tethra DEX Backend running on port ${config_1.config.PORT}`);
            logger.info(`📡 WebSocket: ws://localhost:${config_1.config.PORT}/ws/price`);
            logger.info(`🌐 REST API: http://localhost:${config_1.config.PORT}/api/price`);
            logger.info(`💚 Health check: http://localhost:${config_1.config.PORT}/health`);
            logger.info(`🔥 Environment: ${config_1.config.NODE_ENV}`);
        });
    }
    catch (error) {
        logger.error('Failed to start Tethra DEX Backend:', error);
        process.exit(1);
    }
}
let limitOrderExecutorRef = null;
let positionMonitorRef = null;
let tpslMonitorRef = null;
let tapToTradeExecutorRef = null;
let oneTapProfitMonitorRef = null;
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (limitOrderExecutorRef) {
        limitOrderExecutorRef.stop();
    }
    if (positionMonitorRef) {
        positionMonitorRef.stop();
    }
    if (tpslMonitorRef) {
        tpslMonitorRef.stop();
    }
    if (tapToTradeExecutorRef) {
        tapToTradeExecutorRef.stop();
    }
    if (oneTapProfitMonitorRef) {
        oneTapProfitMonitorRef.stop();
    }
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    if (limitOrderExecutorRef) {
        limitOrderExecutorRef.stop();
    }
    if (positionMonitorRef) {
        positionMonitorRef.stop();
    }
    if (tpslMonitorRef) {
        tpslMonitorRef.stop();
    }
    if (tapToTradeExecutorRef) {
        tapToTradeExecutorRef.stop();
    }
    if (oneTapProfitMonitorRef) {
        oneTapProfitMonitorRef.stop();
    }
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at promise:', { promise: promise.toString(), reason });
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});
main().catch((error) => {
    logger.error('Fatal error in main:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map