import * as util from 'util';
import * as taskLib from 'vsts-task-lib/task';

import downloadutility = require("utility-common/downloadutility");

export class DotNetCoreReleaseFetcher {

    public async getDownloadUrl(platforms: string[], version: string, type: string) {
        let content = await downloadutility.readFileContent(DotNetCoreReleasesUrl);
        let versionsInfo = JSON.parse(content);
        let selectedVersionInfos: any[] = versionsInfo.filter(versionInfo => {
            if (type === 'sdk' && versionInfo['version-sdk'] === version) {
                return true;
            }

            if (type === 'runtime' && versionInfo['version-runtime'] === version) {
                return true;
            }

            return false;
        });

        if (selectedVersionInfos === null || selectedVersionInfos.length == 0) {
            throw taskLib.loc("VersionNotFound", version);
        }

        let selectedVersionInfo = selectedVersionInfos[0];
        let rootUrl: string;
        let fileName: string;
        if (type === 'sdk') {
            rootUrl = selectedVersionInfo['blob-sdk'];
            if (!rootUrl) {
                rootUrl = selectedVersionInfo['dlc-sdk'];
            }

            fileName = selectedVersionInfo['sdk-' + platforms[0]];
            if (!fileName) {
                fileName = selectedVersionInfo['sdk-' + platforms[1]];
            }
        } else if (type === 'runtime') {
            rootUrl = selectedVersionInfo['blob-runtime'];
            if (!rootUrl) {
                rootUrl = selectedVersionInfo['dlc-runtime'];
            }

            fileName = selectedVersionInfo['runtime-' + platforms[0]];
            if (!fileName) {
                fileName = selectedVersionInfo['runtime-' + platforms[1]];
            }
        }

        if (!rootUrl || !fileName) {
            throw taskLib.loc("NullDownloadUrls", version);
        }

        let downloadUrl: string = util.format("%s%s", rootUrl, fileName);
        return downloadUrl;
    }
}

const DotNetCoreReleasesUrl: string = "https://raw.githubusercontent.com/dotnet/core/master/release-notes/releases.json";