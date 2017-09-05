import path = require('path');
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

    public static normalizeRelativePath(inputPath: string) {
        if(tl.osType().match(/^Win/)) {
            var splitPath = inputPath.split(path.sep);
            return path.posix.join.apply(null, splitPath);
        }

        return inputPath;
    }
}

export = Utils;