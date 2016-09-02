import Q = require('q');

import {SonarQubeRunSettings} from './run-settings';
import {SonarQubeMetrics} from './metrics';
import {SonarQubeMeasurementUnit} from './metrics';
import {SonarQubeFailureCondition} from './metrics';

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
            // Quality gate failure details (if applicable)
            this.fetchQualityGateFailureDetails(waitForAnalysis),
            // Link to the SonarQube dashboard
            Q.when<string>(this.createLinkToSonarQubeDashboard())
        ];

        // Resolve them all and return the finished build summary. Rejectionss fail fast.
        return Q.all<string>(reportSectionPromises)
            .then((reportSections:string[]) => {
                // Put the build summary sections together with the Markdown newline
                var buildSummary:string = reportSections.join('  \r\n').trim();
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
                return SonarQubeReportBuilder.createBuildSummaryQualityGateSection(qualityGateStatus)
            })
    }

    /**
     * Fetches the quality gate failure reason and then creates a Markdown-formatted report for display.
     * Returns null if this.taskMetrics is null or the quality gate passed.
     * @returns {Promise<string>} A promise, resolving to a string of a Markdown-formatted report of the quality gate status
     */
    private fetchQualityGateFailureDetails(waitForAnalysis:boolean):Q.Promise<string> {
        if (!waitForAnalysis) {
            // Do not create a quality gate detail section if not waiting for the server to analyse the build
            console.log(tl.loc('sqCommon_NotWaitingForAnalysis'));
            return Q.when<string>(null);
        }
        if (!this.taskMetrics) {
            tl.debug("SQTaskMetrics was null in SQReportBuilder, returning null for quality gate status");
            return Q.when<string>(null);
        }

        return this.taskMetrics.getAnalysisDetails()
            .then((analysisDetails:any) => {
                // If quality gate is neither of FAIL or WARN, return null to hide this section in the build summary
                if (!SonarQubeMetrics.hasQualityGateFailed(SonarQubeMetrics.getQualityGateStatus(analysisDetails)) &&
                !SonarQubeMetrics.hasQualityGateWarned(SonarQubeMetrics.getQualityGateStatus(analysisDetails))) {
                    return null;
                }

                return this.createBuildSummaryQualityGateDetailsSection(analysisDetails);
            });
    }

    /**
     * Creates a build summary section to display the reason(s) the quality gate failed.
     * @param analysisDetails JSON object representation of the task details
     * @returns {string}      A Markdown report of the reasons why the quality gate failed, or null if the quality gate passed or analysisDetails was null
     */
    private createBuildSummaryQualityGateDetailsSection(analysisDetails:any):Q.Promise<string> {
        if (analysisDetails == undefined || analysisDetails == null) {
            return null;
        }

        var failureReasons:SonarQubeFailureCondition[] = SonarQubeMetrics.getFailedConditions(analysisDetails);
        var failureSubsectionPromises = []; // An array of promises, each resolving to one subsection

        failureReasons.forEach((failureReason:SonarQubeFailureCondition) => {
            failureSubsectionPromises.push(this.createQualityGateDetailsSubsection(failureReason));
        });

        // Resolve all subsection promises
        return Q.all(failureSubsectionPromises)
            .then((failureSubsections:string[]) => {
                // remove any null values
                failureSubsections = failureSubsections.filter((n:string) => {
                        return n != null;
                    });

                var subsections:string[] = [];
                subsections.push('<table border="0" style="border-top: 1px solid #eee;border-collapse: separate;border-spacing: 0 2px;">');
                subsections.push(failureSubsections.join('  \r\n').trim());
                subsections.push("</table>");

                var qualityGateDetailsSection:string = subsections.join('  \r\n').trim();
                return qualityGateDetailsSection;
            });
    }

    /**
     * Creates a section describing one reason why the quality gate failed. The quality gate failure details section consists of one or more of these.
     *
     * Example:
     * <div style="padding:5px 0px">
     *             <span>Quality Gate</span>
     *         <span style="padding:4px 10px; margin-left: 5px; background-color:#D4333F; color:#fff; display:inline-block">Failed</span>
     *             </div>
     * <table border="0" style="border-top: 1px solid #eee;border-collapse: separate;border-spacing: 0 2px;">
     * <tr>
     *     <td><span style="padding-right:4px;">Lines</span></td>
     *     <td style="text-align: center; background-color:#D4333F; color:#fff;"><span style="padding:0px 2px">54</span></td>
     *     <td>&nbsp;&#62; 1</td>
     * </tr>
     * </table>
     * [Detailed SonarQube report >](http://sonartfsint-s.cloudapp.net:9000/dashboard/index/test:test "test:test Dashboard")
     *
     * @param failureReason Failure condition that caused the quality gate to warn or fail
     * @returns {Promise<string>} A markdown-formatted subsection that shows the user one reason why the quality gate failed,
     * or null if there was a problem
     */
    private createQualityGateDetailsSubsection(failureReason:SonarQubeFailureCondition):Q.Promise<string> {
        // Some lines involve promises, resolve them first then template relevant variables into the return
        return Q.all([
            this.getMeasurementUnit(failureReason.metricKey),
            this.getValueLabel(failureReason),
            this.getThresholdLabel(failureReason),
        ])
            .then((fulfilledPromiseStrings:any[]) => { // untyped because of multiple types in the array
                //if any fulfilled promise values were null, return null
                if (fulfilledPromiseStrings.indexOf(null) > -1) {
                    return null;
                }

                var backgroundColor:string = SonarQubeReportBuilder.getBackgroundColour(failureReason.status);
                var comparator:string = SonarQubeReportBuilder.getComparatorSymbol(failureReason.comparator);
                var measurementDisplayName:string = (fulfilledPromiseStrings[0] as SonarQubeMeasurementUnit).name;
                var valueLabel:string = <string> fulfilledPromiseStrings[1];
                var thresholdLabel:string = <string> fulfilledPromiseStrings[2];

                return `<tr>
    <td><span style="padding-right:4px;">${measurementDisplayName}</span></td>
    <td style="text-align: center; background-color:${backgroundColor}; color:#fff;"><span style="padding:0px 2px">${valueLabel}</span></td>
    <td>&nbsp;${comparator} ${thresholdLabel}</td>
</tr>`;
            })
    }

    private getValueLabel(failureReason:SonarQubeFailureCondition):Q.Promise<string> {
        var failureValue:string = failureReason.actualValue;
        return this.getMeasurementLabel(failureReason, failureValue);
    }

    private getThresholdLabel(failureReason:SonarQubeFailureCondition):Q.Promise<string> {
        var thresholdValue:string = SonarQubeReportBuilder.getDisplayThreshold(failureReason);
        return this.getMeasurementLabel(failureReason, thresholdValue);
    }

    private getMeasurementLabel(failureReason:SonarQubeFailureCondition, valueString:string):Q.Promise<string> {
        if (failureReason == undefined || failureReason == null) {
            tl.debug('[SQ] Cannot get measurement label: failureReason was null');
            return null;
        } else if ((valueString == undefined || valueString == null)) {
            tl.debug('[SQ] Cannot get measurement label: valueString was null');
            return null;
        }

        return this.getMeasurementUnit(failureReason.metricKey)
            .then((measurementUnit:SonarQubeMeasurementUnit) => {
                var value:number = Number(valueString);

                var roundedValue:number = Math.floor(value);
                var roundedValueString = String(roundedValue);

                switch (measurementUnit.type.toUpperCase()) {
                    case 'WORK_DUR':
                        // Work duration measurements are in minutes and are converted
                        return (this.getWorkDurationLabel(value));
                    case 'PERCENT':
                        return `${roundedValueString}%`;
                    case 'MILLISEC':
                        return `${roundedValueString}ms`;
                    default:
                        return String(value);
                }
            });
    }

    /**
     * Gets the display name i.e. "Technical Debt Ratio" for the given measurement key.
     * @param measurementKey Identifies the display name that will be looked up.
     * @returns User-visible display name.
     */
    private getMeasurementUnit(measurementKey:string):Q.Promise<SonarQubeMeasurementUnit> {
        return this.taskMetrics.getMeasurementDetails()
            .then((measurementUnits:SonarQubeMeasurementUnit[]) => {
                if ((measurementUnits == undefined || measurementUnits == null) ||
                    (measurementKey == undefined || measurementKey == null)) {
                    tl.debug('Cannot get unit display name ');
                    return null;
                }

                // Filter: return the results where the measurement unit key matches the argument.
                var matchingUnits:SonarQubeMeasurementUnit[] = measurementUnits.filter(
                    (measurementUnit) => {return measurementUnit.key == measurementKey}
                );

                if (matchingUnits.length > 1) {
                    tl.debug(`More than one unit matched the key: ${measurementKey}`);
                    return null;
                }

                if (matchingUnits.length < 1) {
                    tl.debug(`No results for unit key: ${measurementKey}`);
                    return null;
                }

                return matchingUnits[0];
            });
    }

    /**
     * Performs conversion of a work duration value (in minutes) to units suitable for user visibility.
     *
     * SonarQube gives work durations in minutes and it uses complex logic to transform those values to hours, work days, weeks, months etc.
     * At this point we only show hours and minutes.
     *
     * @param totalMinutes Number of minutes in the work duration
     * @returns {string} The work duration as a complete string e.g. "1h 27min"
     */
    private getWorkDurationLabel(totalMinutes:number):string {
        var hours:number = Math.floor(totalMinutes / 60);
        var minutes:number = totalMinutes % 60;

        var hoursString:string = '';
        var minutesString:string = '';

        if (hours > 0) {
            hoursString = `${hours}h`;
        }
        if (minutes > 0 || hoursString == '') { // if totalMinutes == 0, result should be '0min'
            minutesString = `${minutes}min`;
        }

        return `${hoursString} ${minutesString}`.trim(); // trim off unnecessary whitespace if one of the fields is 0
    }

    /**
     * Creates a build summary section to display the quality gate status.
     * @param qualityGateStatus A string identifying the quality gate status
     * @returns {string}        A Markdown report for the given quality gate status, or null if qualityGateStatus is null.
     */
    private static createBuildSummaryQualityGateSection(qualityGateStatus:string):string {
        if (qualityGateStatus == undefined || qualityGateStatus == null) {
            return null;
        }

        var visualColor:string = SonarQubeReportBuilder.getBackgroundColour(qualityGateStatus);
        var visualLabel:string;
        switch (qualityGateStatus.toUpperCase()) {
            case 'OK':
                visualLabel = 'Passed';
                break;
            case 'WARN':
                visualLabel = 'Warning';
                break;
            case 'ERROR':
                visualLabel = 'Failed';
                break;
            case 'NONE':
                visualLabel = 'None';
                break;
            default:
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

    /**
     * Given the failure status (warning/error), return the matching threshold.
     * @param failureReason Details of the failure, a subsection of the analysis details
     * @returns {any}       Violated threshold, or null if failure status was null
     */
    private static getDisplayThreshold(failureReason:SonarQubeFailureCondition):string {
        if (failureReason.status == undefined || failureReason.status == null) {
            tl.debug(`[SQ] Cannot get display threshold: failureReason is ${failureReason.status}`);
            return null;
        }

        var status = failureReason.status.toUpperCase();
        switch (status) {
            case 'WARN':
                return failureReason.warningThreshold;
            case 'ERROR':
                return failureReason.errorThreshold;
            case 'OK':
                tl.debug('[SQ] WARNING: Should not have attempted to display a non-failed condition.');
                return null;
            default:
                tl.debug(`[SQ] Unrecognised failure condition status: ${status}`);
                return null;
        }
    }

    /**
     * Returns the colour code associated with a field status.
     * @param fieldStatus A string describing the status of the field
     * @returns {string}  A colour code for visual representation of the given status, or null if fieldStatus was null
     */
    private static getBackgroundColour(fieldStatus:string):string {
        if (fieldStatus == undefined || fieldStatus == null) {
            tl.debug(`[SQ] Cannot get field background color: fieldStatus is ${fieldStatus}`);
            return null;
        }

        switch (fieldStatus.toUpperCase()) {
            case 'OK':
                return '#85BB43';
            case 'WARN':
                return '#F90';
            case 'ERROR':
                return '#D4333F';
            case 'NONE':
                return '#BBB';
            default:
                return '#BBB';
        }
    }

    /**
     * Returns a symbol to represent a string-encoded comparator (i.e. GT => >)
     * @param comparatorString String representation of a comparator symbol
     * @returns {any}          Symbol represented by the given string, or null if comparatorString was null or unrecognised
     */
    private static getComparatorSymbol(comparatorString:string):string {
        if (comparatorString == undefined || comparatorString == null) {
            return null;
        }

        switch (comparatorString.toUpperCase())
        {
            case "EQ":
                return '&#61;';
            case "GT":
                return '&#62;';
            case "LT":
                return '&#60;';
            case "NE":
                return '&#8800;';
            default:
                tl.warning(tl.loc('sqAnalysis_UnknownComparatorString', comparatorString));
                return null;
        }
    }
}