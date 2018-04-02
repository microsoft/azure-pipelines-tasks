import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as semver from 'semver';

import * as task from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as tool from 'vsts-task-tool-lib/tool';

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

interface TaskParameters {
    readonly versionSpec: string;
    readonly outputVariable: string;
    readonly addToPath: boolean;
}

function evaluateVersions(versions: semver.SemVer[], versionSpec: string): semver.SemVer | null {
    task.debug('evaluating ' + versions.length + ' versions');
    versions = versions.sort();
    for (let i = versions.length - 1; i >= 0; i--) {
        const version: semver.SemVer = versions[i];
        const satisfied: boolean = semver.satisfies(version, versionSpec);
        if (satisfied) {
            task.debug('matched: ' + version);
            return version;
        }
    }

    task.debug('match not found');
    return null;
}

export async function useRubyVersion(parameters: TaskParameters, platform: Platform): Promise<void> {
    if (platform === Platform.Windows) {
        const toolName: string = 'Ruby';
        const installDir: string | null = tool.findLocalTool(toolName, parameters.versionSpec);
        if (!installDir) {
            // Fail and list available versions
            throw new Error([
                task.loc('VersionNotFound', parameters.versionSpec),
                task.loc('ListAvailableVersions'),
                tool.findLocalToolVersions(toolName)
            ].join(os.EOL));
        }

        task.setVariable(parameters.outputVariable, installDir);
        if (parameters.addToPath) {
            tool.prependPath(path.resolve(installDir, 'bin'));
        }
    } else {
        const result: tr.IExecSyncResult = task.execSync('ruby-switch', ['--list']);
        if (result.code === task.TaskResult.Succeeded) {
            const versions: string[] = result.stdout ? result.stdout.split(os.EOL) : [];
            const versionSpecs: semver.SemVer[] = [];
            const versionMap: { [key: string]: string; } = {};
            versions.forEach(v =>  {
                const toolName = 'ruby';
                if (v.startsWith(toolName)) {
                    const version = semver.coerce(v.replace(toolName, ''));
                    if (version) {
                        versionSpecs.push(version);
                        versionMap[version.toString()] = v;
                    }
                }
            });

            const foundVersion = evaluateVersions(versionSpecs, parameters.versionSpec);
            if (!foundVersion) {
                // Fail and list available versions
                throw new Error([
                    task.loc('VersionNotFound', parameters.versionSpec),
                    task.loc('ListAvailableVersions'),
                    versions.join(' ')
                ].join(os.EOL));
            }
            task.debug('found version: ' + foundVersion);
            if (task.execSync('sudo', ['ruby-switch', '--set', versionMap[foundVersion.toString()]]).code !== task.TaskResult.Succeeded) {
                task.debug('ruby-switch set did not run successfully');
                throw new Error(result.stderr);
            }
        } else {
            task.debug('ruby-switch list did not run successfully');
            throw new Error(result.stderr);
        }
    }
}
