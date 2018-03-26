import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as semver from 'semver';

import * as task from 'vsts-task-lib/task';
import * as tool from 'vsts-task-tool-lib/tool';

export enum Platform {
    Windows,
    MacOS,
    Linux
}

interface TaskParameters {
    readonly versionSpec: string;
    readonly outputVariable: string;
    readonly addToPath: boolean;
    readonly installDevKit: boolean;
}

export async function useRubyVersion(parameters: TaskParameters): Promise<void> {
    const installDir: string | null = tool.findLocalTool('Ruby', parameters.versionSpec);
    if (!installDir) {
        // Fail and list available versions
        throw new Error([
            task.loc('VersionNotFound', parameters.versionSpec),
            task.loc('ListAvailableVersions'),
            tool.findLocalToolVersions('Ruby')
        ].join(os.EOL));
    }

    task.setVariable(parameters.outputVariable, installDir);
    if (parameters.addToPath) {
        tool.prependPath(installDir);
    }

    // Install DevKit
    if (parameters.installDevKit) {
        // TODO: handle < 2.4
        task.execSync(path.resolve(installDir, 'bin/ridk'), ['install', '3']);
    }
}
