import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib';

export function getAgentExternalsPath(): string {

    const agentRoot: string = process.env.AGENT_HOMEDIRECTORY;

    if (!agentRoot) {
        throw new Error(taskLib.loc('AGENT_HOMEDIRECTORY_NotAvailable'));
    }

    return path.join(agentRoot, 'externals');
}
