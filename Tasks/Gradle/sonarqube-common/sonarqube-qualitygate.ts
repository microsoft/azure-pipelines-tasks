/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import tl = require('../testlib/tasklib-wrapper');

// Creates a build summary section to display the quality gate status.
// Returns null if analysisStatus was null.
export function createBuildSummaryQualityGateSection(analysisStatus:string):string {
    if (!analysisStatus) {
        return null;
    }

    var visualStatus:QualityGateVisualStatus = QualityGateVisualStatus.createFromAnalysisStatus(analysisStatus);

    // ES6 template literal usage to streamline creating this section.
    var reportContents:string  = `<div style="padding:5px 0px">
        <span>Quality Gate</span>
    <span style="padding:4px 10px; margin-left: 5px; background-color:${visualStatus.Color}; color:#fff; display:inline-block">${visualStatus.Label}</span>
        </div>`;

    return reportContents;
}

class QualityGateVisualStatus {
    constructor(public Color: string, public Label: string) {
    }

    public static createFromAnalysisStatus(analysisStatus:string):QualityGateVisualStatus {
        switch (analysisStatus.toUpperCase()) {
            case 'OK':
                return new QualityGateVisualStatus('#85BB43', 'Passed');
            case 'WARN':
                return new QualityGateVisualStatus('#F90', 'Warning');
            case 'ERROR':
                return new QualityGateVisualStatus('#D4333F', 'Failed');
            case 'NONE':
                return new QualityGateVisualStatus('#BBB', 'None');
            default:
                tl.warning(tl.loc('sqCommon_QualityGateStatusUnknown'));
                return new QualityGateVisualStatus('#BBB', 'Unknown');
        }
    }
}