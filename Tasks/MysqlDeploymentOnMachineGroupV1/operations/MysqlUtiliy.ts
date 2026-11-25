
import task = require('azure-pipelines-task-lib/task');
export class Utility {

    /**
     * Rejects file paths that could break out of the mysql source argument. Can be turned off with the MysqlDeploymentOnMachineGroup.DisableSqlFilePathValidation pipeline feature.
     */
    public static validateSqlFilePath(filePath: string): string {
        if (!task.getPipelineFeature('MysqlDeploymentOnMachineGroup.DisableSqlFilePathValidation') && /["';`\r\n\0]/.test(filePath)) {
            throw new Error(task.loc('InvalidSqlFilePath', filePath));
        }
        return filePath;
    }

    /**
     * Is name valid or not
     */
    public static isNameValid(name: string): boolean {
        if (name === null || name === undefined || typeof name.valueOf() !== 'string') {
            return false;
        }else{
            return true;
        }
    }

    public static argStringToArray(argString): string[] {
        var args = [];
        var inQuotes = false;
        var escaped = false;
        var arg = '';
        var append = function (c) {
            // we only escape double quotes.
            if (escaped && c !== '"') {
                arg += '\\';
            }
            arg += c;
            escaped = false;
        };
        for (var i = 0; i < argString.length; i++) {
            var c = argString.charAt(i);
            if (c === '"') {
                if (!escaped) {
                    inQuotes = !inQuotes;
                }
                else {
                    append(c);
                }
                continue;
            }
            if (c === "\\" && inQuotes) {
                if(escaped) {
                    append(c);
                }
                else {
                    escaped = true;
                }
    
                continue;
            }
            if (c === ' ' && !inQuotes) {
                if (arg.length > 0) {
                    args.push(arg);
                    arg = '';
                }
                continue;
            }
            append(c);
        }
        if (arg.length > 0) {
            args.push(arg.trim());
        }
        return args;
    }

}