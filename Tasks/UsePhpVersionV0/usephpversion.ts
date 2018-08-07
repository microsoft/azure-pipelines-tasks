import * as os from 'os';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';

import { Platform } from './taskutil';

interface TaskParameters {
    versionSpec: string,
    architecture: string
}

export async function usePhpVersion(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
    const installDir: string | null = tool.findLocalTool('Php', parameters.versionSpec, parameters.architecture);
    if (!installDir) {
        // Fail and list available versions
        const x86Versions = tool.findLocalToolVersions('Php', 'x86')
            .map(s => `${s} (x86)`)
            .join(os.EOL);

        const x64Versions = tool.findLocalToolVersions('Php', 'x64')
            .map(s => `${s} (x64)`)
            .join(os.EOL);

        throw new Error([
            task.loc('VersionNotFound', parameters.versionSpec, parameters.architecture),
            task.loc('ListAvailableVersions'),
            x86Versions,
            x64Versions
        ].join(os.EOL));
    }

    // TODO add to PATH
}