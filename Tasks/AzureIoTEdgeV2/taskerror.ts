export class TaskError extends Error {
    public errorSummary: string; // Error summary logged to telemetry
    constructor(errorSummary: string, promptMessage: string) {
        super(promptMessage); // The error in parent class will be printed to Azure Pipelines logs
        this.errorSummary = errorSummary;
    }
}