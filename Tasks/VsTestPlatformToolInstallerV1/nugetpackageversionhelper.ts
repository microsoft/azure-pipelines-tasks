import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as perf from 'performance-now';
import * as ci from './cieventlogger';
import * as constants from './constants';

let startTime: number;

export class NugetPackageVersionHelper {

    // Lists the latest version of the package available in the feed specified.
    public getLatestPackageVersionNumber(packageSource: string, includePreRelease: boolean, nugetConfigFilePath: string): string {
        const nugetTool = tl.tool(path.join(__dirname, 'nuget.exe'));

        ci.addToConsolidatedCi('includePreRelease', `${includePreRelease}`);

        // Only search by package id if the feed is the offial nuget feed, otherwise search by package name as not all feeds
        // support searching by package id
        nugetTool.arg(constants.list)
            .argIf(packageSource === constants.defaultPackageSource , `packageid:${constants.packageId}`)
            .argIf(packageSource !== constants.defaultPackageSource , `${constants.packageId}`)
            .argIf(includePreRelease, constants.preRelease)
            .arg(constants.noninteractive).arg(constants.source).arg(packageSource)
            .argIf(nugetConfigFilePath, constants.configFile)
            .argIf(nugetConfigFilePath, nugetConfigFilePath);

        startTime = perf();
        const result = nugetTool.execSync();

        ci.addToConsolidatedCi('ListLatestPackageTime', perf() - startTime);

        if (result.code !== 0 || !(result.stderr === null || result.stderr === undefined || result.stderr === '')) {
            tl.error(tl.loc('NugetErrorCode', result.code));
            ci.addToConsolidatedCi('listingPackagesFailed', 'true');
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