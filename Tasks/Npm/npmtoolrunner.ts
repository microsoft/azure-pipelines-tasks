import * as fs from 'fs';
import { format, parse, Url } from 'url';

import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';

export class NpmToolRunner extends tr.ToolRunner {
    private dbg: boolean;

    constructor(private workingDirectory: string, private npmrc?: string) {
        super('npm');

        this.on('debug', (message: string) => {
            tl.debug(message);
        });

        let debugVar = tl.getVariable('System.Debug') || '';
        if (debugVar.toLowerCase() === 'true') {
            this.dbg = true;
        }
    }

    public exec(options?: tr.IExecOptions): Q.Promise<number> {
        options = this._prepareNpmEnvironment(options) as tr.IExecOptions;

        return super.exec(options);
    }

    public execSync(options?: tr.IExecSyncOptions): tr.IExecSyncResult {
        options = this._prepareNpmEnvironment(options);

        return super.execSync(options);
    }

    private static _getProxyFromEnvironment(): string {
        let proxyUrl: string = tl.getVariable('agent.proxyurl');
        if (proxyUrl) {
            let proxy: Url = parse(proxyUrl);
            let proxyUsername: string = tl.getVariable('agent.proxyusername') || '';
            let proxyPassword: string = tl.getVariable('agent.proxypassword') || '';

            let auth = `${proxyUsername}:${proxyPassword}`;
            proxy.auth = auth;

            return format(proxy);
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

        let proxy = NpmToolRunner._getProxyFromEnvironment();
        if (proxy) {
            tl.debug(`Using proxy "${proxy}" for npm`);
            options.env['NPM_CONFIG_PROXY'] = proxy;
            options.env['NPM_CONFIG_HTTPS-PROXY'] = proxy;
        }

        let config = tl.execSync('npm', `config list ${this.dbg ? '-l' : ''}`, options);
        return options;
    }
}
