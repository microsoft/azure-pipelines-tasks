import * as tl from 'azure-pipelines-task-lib/task';

export const KILLSWITCH_FLAG = 'UseAzureWebAppContainerOutputSanitizationFallback';

const externalOutputOptions: tl.ExternalOutputOptions = {
    source: 'remote'
};
let fallbackEnabled: boolean | undefined;

function isFallbackEnabled(): boolean {
    if (fallbackEnabled === undefined) {
        try {
            fallbackEnabled = tl.getPipelineFeature(KILLSWITCH_FLAG);
        } catch {
            fallbackEnabled = false;
        }
    }
    return fallbackEnabled;
}

export function logExternalOutput(message: string): void {
    if (isFallbackEnabled()) {
        console.log(message);
        return;
    }
    try {
        tl.writeExternalOutput(message + '\n', externalOutputOptions);
    } catch {
        console.log('Unable to write filtered task output.');
    }
}
