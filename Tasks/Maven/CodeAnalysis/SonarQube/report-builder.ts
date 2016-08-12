import Q = require('q');

import {SonarQubeRunSettings} from './run-settings';
import {SonarQubeMetrics} from './metrics';

import tl = require('vsts-task-lib/task');

export class SonarQubeReportBuilder {

    private taskMetrics:SonarQubeMetrics;
    private sqRunSettings:SonarQubeRunSettings;

    /**
     * Creates a new SonarQubeReportBuilder, which creates Markdown-formatted reports for SonarQube analyses.
     * @param sqRunSettings SonarQubeRunSettings object for the applicable run
     * @param taskMetrics   SonarQube metrics for the applicable run
     */
    constructor(sqRunSettings:SonarQubeRunSettings, taskMetrics:SonarQubeMetrics) {
        if (!sqRunSettings) {
            // Looks like: Invalid or missing task report. Check SonarQube finished successfully.
            throw new Error(tl.loc('sqAnalysis_TaskReportInvalid'));
        }

        this.sqRunSettings = sqRunSettings;
        this.taskMetrics = taskMetrics;
    }

    /**
     * Creates a Markdown-formatted build summary, fetching appropriate data (as configured by the user) to do so.
     */
    public fetchMetricsAndCreateReport(waitForAnalysis:boolean):Q.Promise<string> {
        // Start asynchronous processing of all report sections at once, assembling them at the end.
        var reportSectionPromises:Q.Promise<string>[] = [
            // Quality gate status
            this.fetchQualityGateStatusAndCreateReport(waitForAnalysis),
            // Link to the SonarQube dashboard
            Q.when<string>(this.createLinkToSonarQubeDashboard())
        ];

        // Resolve them all and return the finished build summary. Rejectionss fail fast.
        return Q.all<string>(reportSectionPromises)
            .then((reportSections:string[]) => {
                // Put the build summary sections together with the Markdown newline - any null values are ignored
                var buildSummary:string = reportSections.join('  \r\n');
                tl.debug('Build summary:');
                tl.debug(buildSummary);
                return buildSummary;
            });
    }

    /**
     * Creates a Markdown-formatted link to the SonarQube dashboard for this project.
     * @returns {string} A single-line, Markdown-formatted link to the SonarQube dashboard for this project
     */
    private createLinkToSonarQubeDashboard(): string {
        // Looks like: Detailed SonarQube report
        var linkText:string = tl.loc('sqAnalysis_BuildSummary_LinkText');
        // Looks like: "[Detailed SonarQube report >](https://mySQserver:9000/dashboard/index/foo "foo Dashboard")"
        return `[${linkText} >](${this.sqRunSettings.dashboardUrl} \"${this.sqRunSettings.projectKey} Dashboard\")`;
    }

    /**
     * Fetches the quality gate status and then creates a Markdown-formatted report for display.
     * Returns null if this.taskMetrics is null.
     * @returns {Promise<string>} A promise, resolving to a string of a Markdown-formatted report of the quality gate status
     */
    private fetchQualityGateStatusAndCreateReport(waitForAnalysis:boolean):Q.Promise<string> {
        if (!waitForAnalysis) {
            // Do not create a quality gate status section if not waiting for the server to analyse the build
            console.log(tl.loc('sqCommon_NotWaitingForAnalysis'));
            return Q.when<string>(null);
        }
        if (!this.taskMetrics) {
            tl.debug("SQTaskMetrics was null in SQReportBuilder, returning null for quality gate status");
            return Q.when<string>(null);
        }

        return this.taskMetrics.getQualityGateStatus()
            .then((qualityGateStatus:string) => {
                return this.createBuildSummaryQualityGateSection(qualityGateStatus)
            })
    }

    /**
     * Creates a build summary section to display the quality gate status.
     * @param qualityGateStatus A string identifying the quality gate status
     * @returns {string}        A Markdown report for the given quality gate status, or null if qualityGateStatus is null.
     */
    private createBuildSummaryQualityGateSection(qualityGateStatus:string):string {
        if (!qualityGateStatus) {
            return null;
        }

        var visualColor:string;
        var visualLabel:string;
        switch (qualityGateStatus.toUpperCase()) {
            case 'OK':
                visualColor = '#85BB43';
                visualLabel = 'Passed';
                break;
            case 'WARN':
                visualColor = '#F90';
                visualLabel = 'Warning';
                break;
            case 'ERROR':
                visualColor = '#D4333F';
                visualLabel = 'Failed';
                break;
            case 'NONE':
                visualColor = '#BBB';
                visualLabel = 'None';
                break;
            default:
                visualColor = '#BBB';
                visualLabel = 'Unknown';
                tl.warning(tl.loc('sqCommon_QualityGateStatusUnknown'));
                break;
        }

        // ES6 template literal usage to streamline creating this section.
        var reportContents:string  = `<div style="padding:5px 0px">
            <span>Quality Gate</span>
        <span style="padding:4px 10px; margin-left: 5px; background-color:${visualColor}; color:#fff; display:inline-block">${visualLabel}</span>
            </div>`;

        return reportContents;
    }
}