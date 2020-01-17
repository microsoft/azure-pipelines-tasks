import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import * as ltx from "ltx";

import * as auth from "./Authentication";
import * as CommandHelper from "./CommandHelper";
import { INuGetXmlHelper } from "./INuGetXmlHelper";
import * as ngToolRunner from './NuGetToolRunner2';
import * as nutil from "./Utility";

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

        let updatePassword = false;
        const tempPassword = '***redacted***';
        if (username || password) {
            if (!username || !password) {
                tl.debug('Adding NuGet source with username and password, but one of them is missing.');
            }

            tl.debug('Adding NuGet source with username and temp password');
            nugetTool.arg("-Username");
            nugetTool.arg(username);
            nugetTool.arg("-Password");
            nugetTool.arg(tempPassword);
            updatePassword = true;

            if (!CommandHelper.isWindowsAgent()) {
                // only Windows supports DPAPI. Older NuGets fail to add credentials at all if DPAPI fails.
                nugetTool.arg("-StorePasswordInClearText");
            }
        }

        // short run, use execSync
        nugetTool.execSync();

        if (updatePassword) {
            tl.debug('Replacing the temp password with the actual password');
            let xmlString = fs.readFileSync(this._nugetConfigPath).toString();

            // strip BOM; xml parser doesn't like it
            if (xmlString.charCodeAt(0) === 0xFEFF) {
                xmlString = xmlString.substr(1);
            }

            xmlString.replace(tempPassword, password);

            const xml = ltx.parse(xmlString);
            fs.writeFileSync(this._nugetConfigPath, xml.root().toString());
            tl.debug('Successfully updated tempNuget.config');
        }
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
