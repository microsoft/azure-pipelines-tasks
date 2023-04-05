import * as path from 'path';
import * as Q from 'q';
import * as tl from 'azure-pipelines-task-lib/task';
import * as codeCoverageUtilities from 'azure-pipelines-tasks-codecoverage-tools/codecoverageutilities';
import { CodeCoverageEnablerFactory } from 'azure-pipelines-tasks-codecoverage-tools/codecoveragefactory';
import { ICodeCoverageEnabler } from 'azure-pipelines-tasks-codecoverage-tools/codecoverageenabler';
import { ICodeCoveragePreset, ICodeCoverageSettings, IPublishCodeCoverageSettings } from '../interfaces';

const TESTRUN_SYSTEM = 'VSTS - gradle';

/**
 * Setup amd enable code coverage tool
 * @param {ICodeCoverageSettings} settings  - collection of settings to setup and enable code coverage
 * @returns {Q.Promise<boolean>} status of code coverage enabler
 */
export function enableCodeCoverageAsync(settings: ICodeCoverageSettings): Q.Promise<boolean> {
    const buildProperties: { [key: string]: string } = {};

    buildProperties['buildfile'] = path.join(settings.workingDirectory, 'build.gradle');
    buildProperties['classfilter'] = settings.classFilter;
    buildProperties['classfilesdirectories'] = settings.classFilesDirectories;
    buildProperties['summaryfile'] = settings.summaryFileName;
    buildProperties['reportdirectory'] = settings.reportDirectoryName;
    buildProperties['ismultimodule'] = String(settings.isMultiModule);
    buildProperties['gradle5xOrHigher'] = String(settings.gradle5xOrHigher);

    const codeCoverageEnabler: ICodeCoverageEnabler = new CodeCoverageEnablerFactory().getTool('gradle', settings.codeCoverageTool.toLowerCase());
    return codeCoverageEnabler.enableCodeCoverage(buildProperties);
}

/**
 * Publish code coverage results to Azure DevOps
 * @param {IPublishCodeCoverageSettings} settings - collection of settings to publish code coverage results
 */
export async function publishCodeCoverageResultsAsync(settings: IPublishCodeCoverageSettings): Promise<void> {
    if (settings.isCodeCoverageOpted) {
        tl.debug('publishCodeCoverage');

        if (settings.failIfCoverageEmpty && await codeCoverageUtilities.isCodeCoverageFileEmpty(settings.summaryFile, settings.codeCoverageTool)) {
            throw tl.loc('NoCodeCoverage');
        }

        if (tl.exist(settings.summaryFile)) {
            tl.debug(`Summary file = ${settings.summaryFile}`);
            tl.debug(`Report directory = ${settings.reportDirectory}`);
            tl.debug('Publishing code coverage results to TFS');

            const codeCoveragePublisher: tl.CodeCoveragePublisher = new tl.CodeCoveragePublisher();
            codeCoveragePublisher.publish(settings.codeCoverageTool, settings.summaryFile, settings.reportDirectory, '');
        } else {
            tl.warning('No code coverage results found to be published. This could occur if there were no tests executed or there was a build failure. Check the gradle output for details.');
        }
    }
}

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

/**
 * Resolve summary file name and reporting task name for target code coverage tool
 * @param {string} codeCoverageTool - name of target code coverage tool
 * @param {boolean} isMultiModule - flag to indicate if project multi module or not
 * @returns {ICodeCoveragePreset} - summary file name and reporting task name
 */
export function resolveCodeCoveragePreset(codeCoverageTool: string, isMultiModule: boolean): ICodeCoveragePreset {
    const toolName: string = codeCoverageTool.toLowerCase();
    let summaryFileName: string = '';
    let reportingTaskName: string = '';

    switch (toolName) {
        case 'jacoco':
            summaryFileName = 'summary.xml';
            reportingTaskName = isMultiModule ? 'jacocoRootReport' : 'jacocoTestReport';
            break;

        case 'cobertura':
            summaryFileName = 'coverage.xml';
            reportingTaskName = 'cobertura';
            break;

        default:
            summaryFileName = '';
            reportingTaskName = '';
    }

    const codeCoveragePreset: ICodeCoveragePreset = {
        summaryFileName: summaryFileName,
        reportingTaskName: reportingTaskName
    };

    return codeCoveragePreset;
}
