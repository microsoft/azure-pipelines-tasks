import * as tl from 'azure-pipelines-task-lib/task';

export class JenkinsOutput {
    public static log(message: string): void {
        tl.writeExternalOutput(message + '\n', this.options());
    }

    public static debug(message: string): void {
        tl.debugExternalOutput(message, this.options());
    }

    private static options(): tl.ExternalOutputOptions {
        return {
            source: 'remote',
            vsoCommandMode: tl.getPipelineFeature('EnableVsoCommandBlockingRMTasks')
                ? 'blockAndTelemetry'
                : 'telemetryOnly'
        };
    }
}
