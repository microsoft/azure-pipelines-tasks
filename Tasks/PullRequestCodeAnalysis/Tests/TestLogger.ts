import {ILogger} from '../PRCA/ILogger';

/**
 * Test Logger implementation
 * 
 */
export class TestLogger implements ILogger {

    public Warnings: string[] = [];
    public InfoMessages: string[] = [];
    public DebugMessages: string[] = [];

    public LogWarning(message: string): void {
        this.Warnings.push(message);
    }

    public LogInfo(message: string): void {
        this.InfoMessages.push(message);
    }

    public LogDebug(message: string): void {
        this.DebugMessages.push(message);
    }
}