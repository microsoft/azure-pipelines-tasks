import tl = require("vsts-task-lib/task");
class Utils {
    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }

    public static getError(error: any) {
        if (error && error.message) {
            return error.message;
        }
        return error;
    }

    public static getResourceGroupNameFromUri(resourceUri: string): string {
        if (Utils.isNonEmpty(resourceUri)) {
            resourceUri = resourceUri.toLowerCase();
            return resourceUri.substring(resourceUri.indexOf("resourcegroups/") + "resourcegroups/".length, resourceUri.indexOf("/providers"));
        }

        return "";
    }
}

export = Utils;