import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';

import { Platform } from './taskutil';

interface TaskParameters {
}

export async function condaEnvironment(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    // TODO
}
