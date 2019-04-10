import * as tl from "azure-pipelines-task-lib/task";

import * as auth from "./Authentication";
import * as CommandHelper from "./CommandHelper";
import { INuGetXmlHelper } from "./INuGetXmlHelper";
import * as ngToolRunner from './NuGetToolRunner2';

export class NuGetExeXmlHelper implements INuGetXmlHelper {
    constructor(
        private _nugetPath: string,
        private _nugetConfigPath: string,
        private _authInfo: auth.NuGetExtendedAuthInfo,
        private _environmentSettings: ngToolRunner.NuGetEnvironmentSettings
    ) {
    }

    AddSourceToNuGetConfig(name: string, source: string, username?: string, password?: string): void {
        let nugetTool = ngToolRunner.createNuGetToolRunner(this._nugetPath, this._environmentSettings, this._authInfo);
        nugetTool.arg("sources");
        nugetTool.arg("Add");
        nugetTool.arg("-NonInteractive");
        nugetTool.arg("-Name");
        nugetTool.arg(name);
        nugetTool.arg("-Source");
        nugetTool.arg(source);
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(this._nugetConfigPath);

        if (username || password) {
            if (!username || !password) {
                tl.debug('Adding NuGet source with username and password, but one of them is missing.');
            }

            nugetTool.arg("-Username");
            nugetTool.arg(username);
            nugetTool.arg("-Password");
            nugetTool.arg(password);

            if (!CommandHelper.isWindowsAgent()) {
                // only Windows supports DPAPI. Older NuGets fail to add credentials at all if DPAPI fails.
                nugetTool.arg("-StorePasswordInClearText");
            }
        }

        // short run, use execSync
        nugetTool.execSync();
    }

    RemoveSourceFromNuGetConfig(name: string): void {
        let nugetTool = ngToolRunner.createNuGetToolRunner(this._nugetPath, this._environmentSettings, this._authInfo);

        nugetTool.arg("sources");
        nugetTool.arg("Remove");
        nugetTool.arg("-NonInteractive");
        nugetTool.arg("-Name");
        nugetTool.arg(name);
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(this._nugetConfigPath);

        // short run, use execSync
        nugetTool.execSync();
    }

    SetApiKeyInNuGetConfig(source: string, apiKey: string): void {
        let nugetTool = ngToolRunner.createNuGetToolRunner(this._nugetPath, this._environmentSettings, this._authInfo);
        nugetTool.arg("setapikey");
        nugetTool.arg(apiKey);
        nugetTool.arg("-NonInteractive");
        nugetTool.arg("-Source");
        nugetTool.arg(source);
        nugetTool.arg("-ConfigFile");
        nugetTool.arg(this._nugetConfigPath);

        // short run, use execSync
        nugetTool.execSync();
    }
}
