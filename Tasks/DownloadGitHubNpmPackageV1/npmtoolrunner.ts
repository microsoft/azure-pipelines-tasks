import * as fs from 'fs';
import * as path from 'path';
import { format, parse, Url } from 'url';
import * as Q from 'q';

import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';

import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as npmutil from 'azure-pipelines-tasks-packaging-common/npm/npmutil';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';

export class NpmToolRunner extends tr.ToolRunner {
    private cacheLocation: string;
    private dbg: boolean;
    private projectNpmrc: () => string = () => path.join(this.workingDirectory, '.npmrc');

    constructor(private workingDirectory: string, private npmrc: string, private overrideProjectNpmrc: boolean) {
        super('npm');

        this.on('debug', (message: string) => {
            tl.debug(message);
        });

        let debugVar = tl.getVariable('System.Debug') || '';
        if (debugVar.toLowerCase() === 'true') {
            this.dbg = true;
        }

        let cacheOptions = { silent: true } as tr.IExecSyncOptions;
        if (!tl.stats(workingDirectory).isDirectory()) {
            throw new Error(tl.loc('WorkingDirectoryNotDirectory'));
        }
        this.cacheLocation = tl.execSync('npm', 'config get cache', this._prepareNpmEnvironment(cacheOptions)).stdout.trim();
    }

    public exec(options?: tr.IExecOptions): Q.Promise<number> {
        options = this._prepareNpmEnvironment(options) as tr.IExecOptions;

        this._saveProjectNpmrc();
        return super.exec(options).then(
            (code: number): number => {
                this._restoreProjectNpmrc();
                return code;
            },
            (reason: any) => {
                this._restoreProjectNpmrc();
                return this._printDebugLog(this._getDebugLogPath(options)).then((value: void): number => {
                    throw reason;
                });
            }
        );
    }

    public execSync(options?: tr.IExecSyncOptions): tr.IExecSyncResult {
        options = this._prepareNpmEnvironment(options);

        this._saveProjectNpmrc();
        const execResult = super.execSync(options);
        this._restoreProjectNpmrc();
        if (execResult.code !== 0) {
            telemetry.logResult('Packaging', 'npm', execResult.code);
            this._printDebugLogSync(this._getDebugLogPath(options));
            throw new Error(tl.loc('NpmFailed', execResult.code));
        }

        return execResult;
    }

    public static _getProxyFromEnvironment(): string {
        let proxyUrl: string = tl.getVariable('agent.proxyurl');
        if (proxyUrl) {
            let proxy: Url = parse(proxyUrl);
            let proxyUsername: string = tl.getVariable('agent.proxyusername') || '';
            let proxyPassword: string = tl.getVariable('agent.proxypassword') || '';

            if (proxyUsername !== '') {
                proxy.auth = proxyUsername;
            }

            if (proxyPassword !== '') {
                proxy.auth = `${proxyUsername}:${proxyPassword}`;
            }

            const authProxy = format(proxy);

            // register the formatted proxy url as a secret if it contains a password
            if (proxyPassword !== '') {
                tl.setSecret(authProxy);
            }

            return authProxy;
        }

        return undefined;
    }

    private _prepareNpmEnvironment(options?: tr.IExecSyncOptions): tr.IExecSyncOptions {
        options = options || <tr.IExecSyncOptions>{};
        options.cwd = this.workingDirectory;

        if (options.env === undefined) {
            options.env = process.env;
        }

        if (this.dbg) {
            options.env['NPM_CONFIG_LOGLEVEL'] = 'verbose';
        }

        if (this.npmrc) {
            options.env['NPM_CONFIG_USERCONFIG'] = this.npmrc;
        }

        function sanitizeUrl(url: string): string {
            const parsed = parse(url);
            if(parsed.auth) {
                parsed.auth = "***:***";
            }
            return format(parsed);
        }

        let proxy = NpmToolRunner._getProxyFromEnvironment();
        if (proxy) {
            tl.debug(`Using proxy "${sanitizeUrl(proxy)}" for npm`);
            options.env['NPM_CONFIG_PROXY'] = proxy;
            options.env['NPM_CONFIG_HTTPS-PROXY'] = proxy;

            let proxybypass = this._getProxyBypass();
            if (proxybypass != null) {
                
                // check if there are any existing NOPROXY values
                let existingNoProxy = process.env["NO_PROXY"];
                if (existingNoProxy) {
                    existingNoProxy = existingNoProxy.trimRight();
                    // trim trailing comma
                    existingNoProxy = existingNoProxy.endsWith(',') ? existingNoProxy.slice(0,-1) : existingNoProxy;
                    // append our bypass list
                    proxybypass = existingNoProxy + ',' + proxybypass;
                }

                tl.debug(`Setting NO_PROXY for npm: "${proxybypass}"`);
                options.env['NO_PROXY'] = proxybypass;
            }
        }

        let config = tl.execSync('npm', `config list ${this.dbg ? '-l' : ''}`, options);
        return options;
    }

    private _getProxyBypass(): string {    
        // check if there are any proxy bypass hosts
        const proxyBypassHosts: string[] = JSON.parse(tl.getVariable('Agent.ProxyBypassList') || '[]'); 
        if (proxyBypassHosts == null || proxyBypassHosts.length == 0) {
            return undefined;
        }

        // get the potential package sources
        let registries: string[] = npmutil.getAllNpmRegistries(this.projectNpmrc());

        // convert to urls
        let registryUris = registries.reduce(function(result: Url[], currentRegistry: string): Url[] {
            try {
                const uri = parse(currentRegistry);
                if (uri.hostname != null) {
                    result.push(uri);
                }
            }
            finally {
                return result;
            }
        }, []);

        const bypassDomainSet = new Set<string>(); 

        proxyBypassHosts.forEach((bypassHost => {
            // if there are no more registries, stop processing regexes 
            if (registryUris == null || registryUris.length == 0) {
                return;    
            }
   
            let regex = new RegExp(bypassHost, 'i');

            // filter out the registries that match the current regex
            registryUris = registryUris.filter(registryUri => {    
                if (regex.test(registryUri.href)) {
                    bypassDomainSet.add(registryUri.hostname);
                    return false;
                }
                return true;
            });
        }));
    
        // return a comma separated list of the bypass domains
        if (bypassDomainSet.size > 0) {
            const bypassDomainArray = Array.from(bypassDomainSet);
            return bypassDomainArray.join(',');
        }
        return undefined;
    }

    private _getDebugLogPath(options?: tr.IExecSyncOptions): string {
        // check cache
        const logs = tl.findMatch(path.join(this.cacheLocation, '_logs'), '*-debug.log');
        if (logs && logs.length > 0) {
            const debugLog = logs[logs.length - 1];
            console.log(tl.loc('FoundNpmDebugLog', debugLog));
            return debugLog;
        }

        // check working dir
        const cwd = options && options.cwd ? options.cwd : process.cwd();
        const debugLog = path.join(cwd, 'npm-debug.log');
        tl.debug(tl.loc('TestDebugLog', debugLog));
        if (tl.exist(debugLog)) {
            console.log(tl.loc('FoundNpmDebugLog', debugLog));
            return debugLog;
        }

        tl.warning(tl.loc('DebugLogNotFound'));
        return undefined;
    }

    private _printDebugLog(log: string): Q.Promise<void> {
        if (!log) {
            return Q.fcall(() => {});
        }

        return Q.nfcall(fs.readFile, log, 'utf-8').then((data: string) => {
            console.log(data);
        });
    }

    private _printDebugLogSync(log: string): void {
        if (!log) {
            return;
        }

        console.log(fs.readFileSync(log, 'utf-8'));
    }

    private _saveProjectNpmrc(): void {
        if (this.overrideProjectNpmrc) {
            tl.debug(tl.loc('OverridingProjectNpmrc', this.projectNpmrc()));
            util.saveFile(this.projectNpmrc());
            tl.rmRF(this.projectNpmrc());
        }
    }

    private _restoreProjectNpmrc(): void {
        if (this.overrideProjectNpmrc) {
            tl.debug(tl.loc('RestoringProjectNpmrc'));
            util.restoreFile(this.projectNpmrc());
        }
    }
}
