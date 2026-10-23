import * as tl from 'azure-pipelines-task-lib/task';

export class JenkinsOutput {
    private static externalOutputOptions: tl.ExternalOutputOptions;

    public static initialize(): void {
        this.externalOutputOptions = {
            source: 'remote',
            vsoCommandMode: tl.getPipelineFeature('EnableVsoCommandBlockingRMTasks')
                ? 'blockAndTelemetry'
                : 'telemetryOnly'
        };
    }

    public static log(message: string): void {
        tl.writeExternalOutput(message + '\n', this.options);
    }

    public static debug(message: string): void {
        tl.debugExternalOutput(message, this.options);
    }

    public static get options(): tl.ExternalOutputOptions {
        if (!this.externalOutputOptions) {
            this.initialize();
        }
        return this.externalOutputOptions;
    }
}
