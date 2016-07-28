/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import * as tl from 'vsts-task-lib/task';
import {ToolRunner, IExecOptions, IExecResult} from 'vsts-task-lib/toolrunner';
import * as auth from "./Authentication"
import * as os from 'os';
import * as path from 'path';

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
        if (os.platform() === 'win32' || !nuGetExePath.trim().toLowerCase().endsWith('.exe')) {
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

interface LocateOptions {
    /** if true, search along the system path in addition to the hard-coded NuGet tool paths */
    fallbackToSystemPath?: boolean;

    /** Array of filenames to use when searching for the tool. Defaults to the tool name. */
    toolFilenames?: string[];
}

function locateTool(tool: string, opts?: LocateOptions) {
    let searchPath = ["externals/nuget", "agent/Worker/Tools/NuGetCredentialProvider", "agent/Worker/Tools"];
    let agentRoot = tl.getVariable("Agent.HomeDirectory");

    opts = opts || {};
    opts.toolFilenames = opts.toolFilenames || [tool];

    tl.debug(`looking for tool ${tool}`)

    for (let thisVariant of opts.toolFilenames)
    {
        tl.debug(`looking for tool variant ${thisVariant}`);

        for (let possibleLocation of searchPath) {
            let fullPath = path.join(agentRoot, possibleLocation, thisVariant);
            tl.debug(`checking ${fullPath}`);
            if (tl.exist(fullPath)) {
                return fullPath;
            }
        }

        if (opts.fallbackToSystemPath) {
            tl.debug('Checking system path');
            let whichResult = tl.which(thisVariant);
            if (whichResult) {
                tl.debug(`found ${whichResult}`);
                return whichResult;
            }
        }

        tl.debug("not found");
    }

    return null;
}

export function locateNuGetExe(userNuGetExePath: string): string {
    if (userNuGetExePath) {
        tl.debug(`using user-supplied NuGet path ${userNuGetExePath}`)
        tl.checkPath(userNuGetExePath, 'NuGet');
        return userNuGetExePath;
    }

    var toolPath = locateTool('NuGet', {
        fallbackToSystemPath: os.platform() !== 'win32',
        toolFilenames: ['nuget.exe', 'NuGet.exe', 'nuget', 'NuGet']
    });

    
    if (!toolPath) {
        throw new Error(tl.loc("NGCommon_UnableToFindTool", 'NuGet'));
    }

    return toolPath;
}

export function locateCredentialProvider(): string {
    return locateTool('CredentialProvider.TeamBuild.exe');
}