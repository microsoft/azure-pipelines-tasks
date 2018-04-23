import * as task from 'vsts-task-lib/task';
import { ToolRunner } from 'vsts-task-lib/toolrunner';

import { Platform } from './taskutil';


export function findConda(platform: Platform): string | null {
    // TODO
    return null;
}

export async function downloadConda(platform: Platform): Promise<string> {
    // TODO
    return Promise.reject("not implemented");
}

export async function createEnvironment(condaPath: string, environmentName: string, packageSpecs?: string, otherOptions?: string): Promise<void> {
    // TODO validate `environmentName`
    // TODO validate `otherOptions`
    // TODO
    return Promise.reject("not implemented");
    // const conda = new ToolRunner(condaPath);
    // conda.arg('create');
    // conda.arg(environmentName);
    // if (packageSpecs) {
    //     conda.line(packageSpecs);
    // }

    // const status = await conda.exec();
    // if (status !== 0) {
    //     throw new Error(task.loc('FailedCreate', environmentName, status));
    // }
}

export async function activateEnvironment(environmentName: string): Promise<number> {
    // TODO
    return Promise.reject("not implemented");
}