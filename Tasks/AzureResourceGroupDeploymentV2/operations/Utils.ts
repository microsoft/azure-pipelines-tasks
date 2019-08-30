import util = require("util");

import tl = require("vsts-task-lib/task");

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

    public static formatNumber(num: number): string {
        return ("0" + num).slice(-2);
    }

    public static stripJsonComments(content) {
        if (!content || (content.indexOf("//") < 0 && content.indexOf("/*") < 0)) {
            return content;
        }
    
        var currentChar;
        var nextChar;
        var insideQuotes = false;
        var contentWithoutComments = '';
        var insideComment = 0;
        var singlelineComment = 1;
        var multilineComment = 2;
    
        for (var i = 0; i < content.length; i++) {
            currentChar = content[i];
            nextChar = i + 1 < content.length ? content[i + 1] : "";
    
            if (insideComment) {
                var update = false;
                if (insideComment == singlelineComment && (currentChar + nextChar === '\r\n' || currentChar === '\n')) {
                    i--;
                    insideComment = 0;
                    continue;
                }
    
                if (insideComment == multilineComment && currentChar + nextChar === '*/') {
                    i++;
                    insideComment = 0;
                    continue;
                }
    
            } else {
                if (insideQuotes && currentChar == "\\") {
                    contentWithoutComments += currentChar + nextChar;
                    i++; // Skipping checks for next char if escaped
                    continue;
                }
                else {
                    if (currentChar == '"') {
                        insideQuotes = !insideQuotes;
                    }
    
                    if (!insideQuotes) {
                        if (currentChar + nextChar === '//') {
                            insideComment = singlelineComment;
                            i++;
                        }
    
                        if (currentChar + nextChar === '/*') {
                            insideComment = multilineComment;
                            i++;
                        }
                    }
                }
            }
    
            if (!insideComment) {
                contentWithoutComments += content[i];
            }
        }
    
        return contentWithoutComments;
    }
}

export = Utils;