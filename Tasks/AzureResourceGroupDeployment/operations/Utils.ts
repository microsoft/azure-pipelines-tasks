import tl = require("vsts-task-lib/task");
class Utils {
    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }

    public static getError(error: any) {
        tl.debug(JSON.stringify(error));
        if (error && error.message) {
            return error.message;
        }

        return error;
    }
}

export = Utils;