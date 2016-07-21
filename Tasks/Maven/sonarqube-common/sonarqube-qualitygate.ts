/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import tl = require('../testlib/tasklib-wrapper');

// Creates a build summary section to display the quality gate status.
// Returns null if analysisStatus was null.
export function createBuildSummaryQualityGateSection(analysisStatus:string):string {
    if (!analysisStatus) {
        return null;
    }


    var visualColor:string;
    var visualLabel:string;
    switch (analysisStatus.toUpperCase()) {
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