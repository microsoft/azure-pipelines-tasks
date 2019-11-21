import util = require("util");

import tl = require("azure-pipelines-task-lib/task");

class Utils {
    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }

    public static getError(error: any): string {
        if (error && error.message) {
            return JSON.stringify(error.message);
        }

        if (typeof error === "string") {
            return error;
        }

        return JSON.stringify(error);
    }

    public static buildErrorString(errors: string[]): string {
        let index: number = 1;
        return errors.map(error => !!error ? util.format("%s. %s \n", index++, error) : "").join("");
    }
}

export = Utils;