/**
 * Utility function to log telemetry.
 * @param feature The task/feature name for this telemetry
 * @param telem A JSON object containing a dictionary of variables that will be appended to
 * common system vars and loggged.
 */
export declare function emitTelemetry(area: string, feature: string, taskSpecificTelemetry: any): void;
