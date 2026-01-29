import { Router, Request, Response } from 'express';
import { TPSLMonitor } from '../services/TPSLMonitor';
import { TPSLCreateRequest } from '../types';

export function createTPSLRoute(tpslMonitor: TPSLMonitor, tpslMonitorIdrx?: TPSLMonitor): Router {
  const router = Router();
  const resolveMonitor = (token?: string) => {
    if (token && token.toUpperCase() === 'IDRX' && tpslMonitorIdrx) {
      return tpslMonitorIdrx;
    }
    return tpslMonitor;
  };


  /**
   * Set or update TP/SL for a position
   * POST /api/tpsl/set
   * Body: { positionId, trader, takeProfit?, stopLoss? }
   */
  router.post('/set', async (req: Request, res: Response) => {
    try {
      const { positionId, trader, takeProfit, stopLoss, collateralToken } = req.body;

      // Validation
      if (!positionId || !trader) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          required: ['positionId', 'trader'],
          timestamp: Date.now()
        });
      }

      if (!takeProfit && !stopLoss) {
        return res.status(400).json({
          success: false,
          error: 'At least one of takeProfit or stopLoss must be provided',
          timestamp: Date.now()
        });
      }

      // Convert string prices to BigInt (8 decimals)
      const takeProfitBigInt = takeProfit ? BigInt(Math.round(parseFloat(takeProfit) * 100000000)) : undefined;
      const stopLossBigInt = stopLoss ? BigInt(Math.round(parseFloat(stopLoss) * 100000000)) : undefined;

      // Set TP/SL
      const result = await resolveMonitor(collateralToken).setTPSL(
        positionId,
        trader,
        takeProfitBigInt,
        stopLossBigInt
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
          timestamp: Date.now()
        });
      }

      // Convert BigInt to string for JSON response
      const responseConfig = result.config ? {
        ...result.config,
        entryPrice: result.config.entryPrice.toString(),
        takeProfit: result.config.takeProfit?.toString(),
        stopLoss: result.config.stopLoss?.toString()
      } : undefined;

      res.json({
        success: true,
        message: result.message,
        data: responseConfig,
        timestamp: Date.now()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to set TP/SL',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Get all TP/SL configs
   * GET /api/tpsl/all
   * NOTE: Must be before /:positionId route
   */
  router.get('/all', (req: Request, res: Response) => {
    try {
      const { collateralToken } = req.query;
      const configs = resolveMonitor(collateralToken as string | undefined).getAllTPSL();

      // Convert BigInt to string for JSON response
      const responseConfigs = configs.map(config => ({
        ...config,
        entryPrice: config.entryPrice.toString(),
        takeProfit: config.takeProfit?.toString(),
        stopLoss: config.stopLoss?.toString()
      }));

      res.json({
        success: true,
        data: responseConfigs,
        count: responseConfigs.length,
        timestamp: Date.now()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get TP/SL configs',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Get TP/SL config for a position
   * GET /api/tpsl/:positionId
   */
  router.get('/:positionId', (req: Request, res: Response) => {
    try {
      const positionId = parseInt(req.params.positionId);

      if (isNaN(positionId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid position ID',
          timestamp: Date.now()
        });
      }

      const { collateralToken } = req.query;
      const config = resolveMonitor(collateralToken as string | undefined).getTPSL(positionId);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'TP/SL config not found for this position',
          timestamp: Date.now()
        });
      }

      // Convert BigInt to string for JSON response
      const responseConfig = {
        ...config,
        entryPrice: config.entryPrice.toString(),
        takeProfit: config.takeProfit?.toString(),
        stopLoss: config.stopLoss?.toString()
      };

      res.json({
        success: true,
        data: responseConfig,
        timestamp: Date.now()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get TP/SL config',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Delete TP/SL config for a position
   * DELETE /api/tpsl/:positionId
   * Body: { trader }
   */
  router.delete('/:positionId', (req: Request, res: Response) => {
    try {
      const positionId = parseInt(req.params.positionId);
      const { trader, collateralToken } = req.body;

      if (isNaN(positionId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid position ID',
          timestamp: Date.now()
        });
      }

      if (!trader) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: trader',
          timestamp: Date.now()
        });
      }

      const result = resolveMonitor(collateralToken).deleteTPSL(positionId, trader);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message,
          timestamp: Date.now()
        });
      }

      res.json({
        success: true,
        message: result.message,
        timestamp: Date.now()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete TP/SL config',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  /**
   * Get TP/SL monitor status
   * GET /api/tpsl/status
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const { collateralToken } = req.query;
      const status = resolveMonitor(collateralToken as string | undefined).getStatus();

      res.json({
        success: true,
        data: status,
        timestamp: Date.now()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get monitor status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  return router;
}
