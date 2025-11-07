import * as tl from 'azure-pipelines-task-lib/task';

const TESTRUN_SYSTEM = 'VSTS - gradle';


/**
 * Publish unit tests results to Azure DevOps
 * @param {boolean} publishJUnitResults - if set to `true`, the result of the unit tests will be published otherwise publishing will be skipped
 * @param {string} testResultsFiles - pattern for test results files
 */
export function publishTestResults(publishJUnitResults: boolean, testResultsFiles: string): number {
    if (publishJUnitResults) {
        let matchingTestResultsFiles: string[] = [];

        // check for pattern in testResultsFiles
        if (testResultsFiles.indexOf('*') >= 0 || testResultsFiles.indexOf('?') >= 0) {
            tl.debug('Pattern found in testResultsFiles parameter');

            const buildFolder: string = tl.getVariable('System.DefaultWorkingDirectory');

            // The find options are as default, except the `skipMissingFiles` option is set to `true`
            // so there will be a warning instead of an error if an item will not be found
            const findOptions: tl.FindOptions = {
                allowBrokenSymbolicLinks: false,
                followSpecifiedSymbolicLink: true,
                followSymbolicLinks: true,
                skipMissingFiles: true
            };

            matchingTestResultsFiles = tl.findMatch(buildFolder, testResultsFiles, findOptions, { matchBase: true });
        } else {
            tl.debug('No pattern found in testResultsFiles parameter');
            matchingTestResultsFiles = [testResultsFiles];
        }

        if (!matchingTestResultsFiles || matchingTestResultsFiles.length === 0) {
            console.log(tl.loc('NoTestResults', testResultsFiles));
            return 0;
        }

        const tp: tl.TestPublisher = new tl.TestPublisher('JUnit');
        const testRunTitle = tl.getInput('testRunTitle');

        tp.publish(matchingTestResultsFiles, 'true', '', '', testRunTitle, 'true', TESTRUN_SYSTEM);
    }
}
