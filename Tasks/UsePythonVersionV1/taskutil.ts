import * as task from 'azure-pipelines-task-lib/task';

// TODO remove this when mock-task includes task.Platform

export enum Platform {
    Windows,
    MacOS,
    Linux
}

export function getPlatform(): Platform {
    switch (process.platform) {
        case 'win32': return Platform.Windows;
        case 'darwin': return Platform.MacOS;
        case 'linux': return Platform.Linux;
        default: throw Error(task.loc('PlatformNotRecognized'));
    }
}
