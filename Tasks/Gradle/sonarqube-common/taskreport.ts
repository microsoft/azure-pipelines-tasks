import tl = require('vsts-task-lib/task');

// Data class representing the report-task.txt file contents.
export class TaskReport {

    constructor(public projectKey: string,
                public serverUrl: string,
                public dashboardUrl: string,
                public ceTaskId: string,
                public ceTaskUrl: string) {
        if (!projectKey) {
            // Looks like: Failed to create TaskReport object. Missing field: projectKey
            throw new Error(tl.loc('sqCommon_CreateTaskReport_MissingField', 'projectKey'));
        }
        if (!serverUrl) {
            // Looks like: Failed to create TaskReport object. Missing field: serverUrl
            throw new Error(tl.loc('sqCommon_CreateTaskReport_MissingField', 'serverUrl'));
        }
        if (!dashboardUrl) {
            // Looks like: Failed to create TaskReport object. Missing field: dashboardUrl
            throw new Error(tl.loc('sqCommon_CreateTaskReport_MissingField', 'dashboardUrl'));
        }
        if (!ceTaskId) {
            // Looks like: Failed to create TaskReport object. Missing field: ceTaskId
            throw new Error(tl.loc('sqCommon_CreateTaskReport_MissingField', 'ceTaskId'));
        }
        if (!ceTaskUrl) {
            // Looks like: Failed to create TaskReport object. Missing field: ceTaskUrl
            throw new Error(tl.loc('sqCommon_CreateTaskReport_MissingField', 'ceTaskUrl'));
        }
    }

    // Create a TaskReport data class from the map representation of the report-task.txt file.
    public static createTaskReportFromMap(taskReportMap: Map<string, string>): TaskReport {
        return new TaskReport(taskReportMap.get('projectKey'),
                taskReportMap.get('serverUrl'),
                taskReportMap.get('dashboardUrl'),
                taskReportMap.get('ceTaskId'),
                taskReportMap.get('ceTaskUrl')
        );
    }
}
