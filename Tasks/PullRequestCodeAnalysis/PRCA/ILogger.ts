/**
 * Contract allowing callers of the module to specify their own logger
 * 
 * @export
 * @interface ILogger
 */
export interface ILogger {
    /**
    * Log a message with warning verbosity 
    */
    LogWarning(message: string): void;

    /**
     * Log a message with normal / info verbosity 
     */
    LogInfo(message: string): void;

    /**
     * Log a message with debug verbosity
     */
    LogDebug(message: string): void;
}