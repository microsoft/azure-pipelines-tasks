import Q = require('q');

import {SonarQubeRunSettings} from './sonarqube-runsettings';
import {SonarQubeMetrics} from './sonarqube-metrics';

import tl = require('vsts-task-lib/task');

export class SonarQubeReportBuilder {

    private taskMetrics:SonarQubeMetrics;
    private sqRunSettings:SonarQubeRunSettings;

    /**
     * Creates a new SonarQubeReportBuilder, which creates Markdown-formatted reports for SonarQube analyses.
     * @param sqRunSettings SonarQubeRunSettings object for the applicable run
     * @param taskMetrics
     */
    constructor(sqRunSettings:SonarQubeRunSettings, taskMetrics:SonarQubeMetrics) {
        if (!sqRunSettings) {
            // Looks like: Invalid or missing task report. Check SonarQube finished successfully.
            throw new Error(tl.loc('sqAnalysis_TaskReportInvalid'));
        }

        this.sqRunSettings = sqRunSettings;
        this.taskMetrics = taskMetrics;
    }


    // Creates a string containing Markdown of a link to the SonarQube dashboard for this project.
    /**
     * Creates a Markdown-formatted link to the SonarQube dashboard for this project.
     * @returns {string} A single-line, Markdown-formatted link to the SonarQube dashboard for this project
     */
    public createLinkToSonarQubeDashboard(): string {
        // Looks like: Detailed SonarQube report
        var linkText:string = tl.loc('sqAnalysis_BuildSummary_LinkText');
        return `[${linkText} >](${this.sqRunSettings.dashboardUrl} \"${this.sqRunSettings.projectKey} Dashboard\")`;
    }

    /**
     * Fetches the quality gate status and then creates a Markdown-formatted report for display.
     * Returns null if this.taskMetrics is null.
     * @returns {Promise<string>} A promise, resolving to a string of a Markdown-formatted report of the quality gate status
     */
    public fetchQualityGateStatusAndCreateReport():Q.Promise<string> {
        if (!this.taskMetrics) {
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