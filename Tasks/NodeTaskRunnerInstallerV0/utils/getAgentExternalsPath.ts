import * as path from 'path';

export function getAgentExternalsPath(): string {

    const agentRoot: string = process.env.AGENT_HOMEDIRECTORY;

    return path.resolve(agentRoot, 'externals');
}
