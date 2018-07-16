import * as tl from 'vsts-task-lib/task';
import * as path from 'path';
import { exec } from 'child_process';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';

export class NugetPackageVersionHelper {
    private consolidatedCiData: { [key: string]: string; } = <{ [key: string]: string; }>{};

    public constructor(consolidatedCiData: { [key: string]: string; }) {
        this.consolidatedCiData = consolidatedCiData;
    }

    // Lists the latest version of the package available in the feed specified.
    public getLatestPackageVersionNumber(packageSource: string, includePreRelease: boolean, nugetConfigFilePath: string): string {
        const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

        this.consolidatedCiData.includePreRelease = `${includePreRelease}`;

        nugetTool.arg(constants.list).arg(`packageid:${constants.packageId}`).argIf(includePreRelease, constants.preRelease)
            .arg(constants.source).arg(packageSource).argIf(nugetConfigFilePath, constants.configFile)
            .argIf(nugetConfigFilePath, nugetConfigFilePath);

        this.consolidatedCiData.ListLatestPackageStartTime = perf();
        const result = nugetTool.execSync();

        this.consolidatedCiData.ListLatestPackageEndTime = perf();
        ci.publishEvent('ListLatestVersion', { includePreRelease: includePreRelease, 
            startTime: this.consolidatedCiData.ListLatestPackageStartTime,
            endTime: this.consolidatedCiData.ListLatestPackageEndTime } );

        if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
            tl.error(tl.loc('NugetErrorCode', result.code));
            this.consolidatedCiData.listingPackagesFailed = 'true';
            throw new Error(tl.loc('ListPackagesFailed', result.code, result.stderr, result.stdout));
        }

        const listOfPackages = result.stdout.split('\r\n');
        let version: string;

        // parse the version number from the output string
        listOfPackages.forEach(nugetPackage => {
            if (nugetPackage.split(' ')[0] === constants.packageId) {
                version = nugetPackage.split(' ')[1];
                return;
            }
        });

        return version;
    }
}