import { GridSession, GridCell, GridCellStatus, CreateGridSessionRequest, CreateGridCellRequest, GridSessionResponse } from '../types/gridTrading';
export declare class GridTradingService {
    private readonly logger;
    private gridSessions;
    private gridCells;
    private userGrids;
    private cellsByGrid;
    constructor();
    createGridSession(params: CreateGridSessionRequest): GridSession;
    createGridCell(params: CreateGridCellRequest): GridCell;
    addOrderToCell(cellId: string, orderId: string): void;
    getUserGrids(trader: string): GridSession[];
    getGridCells(gridSessionId: string): GridCell[];
    getGridSessionWithCells(gridSessionId: string): GridSessionResponse | null;
    getActiveCells(): GridCell[];
    updateCellStatus(cellId: string, status: GridCellStatus): void;
    cancelGridSession(gridId: string, trader: string): void;
    cancelGridCell(cellId: string, trader: string): void;
    getGridSession(gridId: string): GridSession | undefined;
    getGridCell(cellId: string): GridCell | undefined;
    cleanupExpiredCells(): number;
    getStats(): {
        totalSessions: number;
        activeSessions: number;
        totalCells: number;
        activeCells: number;
        totalOrders: number;
        uniqueTraders: number;
    };
    private generateId;
}
//# sourceMappingURL=GridTradingService.d.ts.map