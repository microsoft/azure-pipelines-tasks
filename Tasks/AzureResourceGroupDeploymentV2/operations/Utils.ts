import tl = require("vsts-task-lib/task");
class Utils {
    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }

    public static getError(error: any): string {
        if (error && error.message) {
            return JSON.stringify(error.message);
        }

        return JSON.stringify(error);
    }
}

export = Utils;