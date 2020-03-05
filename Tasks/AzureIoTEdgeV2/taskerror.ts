export class TaskError extends Error {
    public errorSummary: string; // Error summary logged to telemetry
    public promptMessage: string; // Message printed to Azure Pipelines log
    constructor(errorSummary: string, promptMessage: string) {
        super(promptMessage);
        this.errorSummary = errorSummary;
        this.promptMessage = promptMessage;
    }
}