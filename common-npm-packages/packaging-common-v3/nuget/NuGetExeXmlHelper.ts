import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";

import * as auth from "./Authentication";
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

        let updatePassword = false;
        // adding a random guid to the password to reduce the possibility of it appearing anywhere else in the nuget.config file.
        const tempPassword = 'password-733b11bd-d341-40d8-afcf-b32d5ce6f23a';
        if (username || password) {
            if (!username || !password) {
                tl.debug('Adding NuGet source with username and password, but one of them is missing.');
            }

            tl.debug('Adding NuGet source with username and temp password');
            nugetTool.arg("-Username");
            nugetTool.arg(username);
            nugetTool.arg("-Password");
            nugetTool.arg(tempPassword);
            // temp password must be stored in clear text so that it can be found and replaced
            // temp password is needed because we don't want to call nuget with a real token
            nugetTool.arg("-StorePasswordInClearText");
            updatePassword = true;
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

            xmlString = xmlString.replace(tempPassword, password);

            fs.writeFileSync(this._nugetConfigPath, xmlString);
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
