// Data class representing the report-task.txt file contents.
export class TaskReport {

    constructor(public projectKey: string,
                public serverUrl: string,
                public dashboardUrl: string,
                public ceTaskId: string,
                public ceTaskUrl: string) {
        if (!projectKey) {
            throw new Error("Failed to create TaskReport object. Missing field: projectKey");
        }
        if (!serverUrl) {
            throw new Error("Failed to create TaskReport object. Missing field: serverUrl");
        }
        if (!dashboardUrl) {
            throw new Error("Failed to create TaskReport object. Missing field: dashboardUrl");
        }
        if (!ceTaskId) {
            throw new Error("Failed to create TaskReport object. Missing field: ceTaskId");
        }
        if (!ceTaskUrl) {
            throw new Error("Failed to create TaskReport object. Missing field: ceTaskUrl");
        }
    }

    // Create a TaskReport data class from the map representation of the report-task.txt file.
    public static createTaskReportFromMap(taskReportMap: Map<string, string>): TaskReport {
        return new TaskReport(taskReportMap.get("projectKey"),
                taskReportMap.get("serverUrl"),
                taskReportMap.get("dashboardUrl"),
                taskReportMap.get("ceTaskId"),
                taskReportMap.get("ceTaskUrl")
        );
    }
}
