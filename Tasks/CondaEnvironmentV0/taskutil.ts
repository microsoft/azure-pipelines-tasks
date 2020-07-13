import * as task from 'azure-pipelines-task-lib/task';

// TODO move this to azure-pipelines-task-lib 
export enum Platform {
    Windows,
    MacOS,
    Linux
}

/**
 * Determine the operating system the build agent is running on.
 * TODO move this to azure-pipelines-task-lib
 */
export function getPlatform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: throw Error(task.loc('PlatformNotRecognized'));
    }
}
