/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import * as tl from 'vsts-task-lib/task';
import {ToolRunner, IExecOptions, IExecResult} from 'vsts-task-lib/toolrunner';
import * as auth from "./Authentication"
import * as os from 'os';
import * as path from 'path';

tl.setResourcePath(path.join(__dirname, "module.json"));

interface EnvironmentDictionary { [key: string]: string }

export interface NuGetEnvironmentSettings {
    authInfo: auth.NuGetAuthInfo;
    credProviderFolder: string;
    extensionsDisabled: boolean;
}

function prepareNuGetExeEnvironment(input: EnvironmentDictionary, settings: NuGetEnvironmentSettings): EnvironmentDictionary {
    var env: EnvironmentDictionary = {}
    var originalCredProviderPath: string;
    for (var e in input) {
        // NuGet.exe extensions only work with a single specific version of nuget.exe. This causes problems
        // whenever we update nuget.exe on the agent.
        if (e.toUpperCase() == "NUGET_EXTENSIONS_PATH") {
            if (settings.extensionsDisabled) {
                tl.warning(tl.loc("NGCommon_IgnoringNuGetExtensionsPath"))
                continue;
            } else {
                tl._writeLine(tl.loc("NGCommon_DetectedNuGetExtensionsPath", input[e]))
            }
        }

        if (e.toUpperCase() == 'NUGET_CREDENTIALPROVIDERS_PATH') {
            originalCredProviderPath = input[e];

            // will re-set this variable below
            continue;
        }

        env[e] = input[e];
    }

    var credProviderPath = settings.credProviderFolder || originalCredProviderPath;
    if (settings.credProviderFolder && originalCredProviderPath) {
        credProviderPath = settings.credProviderFolder + ";" + originalCredProviderPath;
    }

    env['VSS_NUGET_ACCESSTOKEN'] = settings.authInfo.accessToken;
    env['VSS_NUGET_URI_PREFIXES'] = settings.authInfo.uriPrefixes.join(";");
    env['NUGET_CREDENTIAL_PROVIDER_OVERRIDE_DEFAULT'] = 'true';

    if (credProviderPath) {
        env['NUGET_CREDENTIALPROVIDERS_PATH'] = credProviderPath;
    }

    return env;
}

export class NuGetToolRunner extends ToolRunner {
    private _settings: NuGetEnvironmentSettings;

    constructor(nuGetExePath: string, settings: NuGetEnvironmentSettings) {
        if (os.platform() === 'win32') {
            super(nuGetExePath);
        }
        else {
            let monoPath = tl.which('mono', true);
            super(monoPath);
            this.pathArg(nuGetExePath);
        }

        this._settings = settings;
    }

    public execSync(options?: IExecOptions): IExecResult {
        options = options || <IExecOptions>{};
        options.env = prepareNuGetExeEnvironment(options.env || process.env, this._settings);
        return super.execSync(options);
    }

    public exec(options?: IExecOptions): Q.Promise<number> {
        options = options || <IExecOptions>{};
        options.env = prepareNuGetExeEnvironment(options.env || process.env, this._settings);
        return super.exec(options);
    }
}

export function createNuGetToolRunner(nuGetExePath: string, settings: NuGetEnvironmentSettings): NuGetToolRunner {
    let runner = new NuGetToolRunner(nuGetExePath, settings);
    runner.on('debug', message => tl.debug(message));
    return runner;
}

export function locateTool(tool: string, userPath?: string, optional?: boolean) {
    tl.debug("looking for tool " + tool);
    if (userPath) {
        tl.debug("using user-supplied path " + userPath)
        tl.checkPath(userPath, 'nuget');
        return userPath;
    }

    var agentRoot = tl.getVariable("Agent.HomeDirectory");
    var newAgentLocation = path.join(agentRoot, "externals/nuget", tool);
    tl.debug("checking " + newAgentLocation);
    if (tl.exist(newAgentLocation)) {
        return newAgentLocation;
    }

    var oldAgentLocation = path.join(agentRoot, "agent/Worker/Tools", tool);
    tl.debug("checking " + oldAgentLocation);
    if (tl.exist(oldAgentLocation)) {
        return oldAgentLocation;
    }

    if (!optional) {
        throw new Error(tl.loc("NGCommon_UnableToFindTool", tool));
    }

    return null;
}