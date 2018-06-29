import * as fs from 'fs';
import * as tl from 'vsts-task-lib/task';
import * as tr from 'vsts-task-lib/toolrunner';
import * as path from 'path';
import * as Q from 'q';
import * as models from './models';
import * as os from 'os';
import * as ci from './cieventlogger';

const str = require('string');
const uuid = require('uuid');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

export class Constants {
    public static vsTestVersionString = 'version';
    public static vsTestLocationString = 'location';
    public static systemDefaultWorkingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
}

export class Helper {
    public static addToProcessEnvVars(envVars: { [key: string]: string; }, name: string, value: string) {
        if (!this.isNullEmptyOrUndefined(value)) {
            if (!name.includes('AccessToken')) {
                tl.debug('Setting the process env var: ' + name + ' to: ' + value);
            }
            envVars[name] = value;
        }
    }

    public static setEnvironmentVariableToString(envVars: { [key: string]: string; }, name: string, value: any) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value.toString();
        }
    }

    public static isNullEmptyOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }

    public static isNullOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }

    public static isNullOrWhitespace(input) {
        if (typeof input === 'undefined' || input === null) {
            return true;
        }
        return input.replace(/\s/g, '').length < 1;
    }

    public static trimString(input: string): string {
        if (input) {
            return input.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, '');
        }
        return input;
    }

    public static isToolsInstallerFlow(config: any) {
        return config.toolsInstallerConfig && config.toolsInstallerConfig.isToolsInstallerInUse;
    }

    public static pathExistsAsFile(path: string) {
        return tl.exist(path) && tl.stats(path).isFile();
    }

    public static pathExistsAsDirectory(path: string) {
        return tl.exist(path) && tl.stats(path).isDirectory();
    }

    public static isDebugEnabled(): boolean {
        const sysDebug = tl.getVariable('System.Debug');
        if (sysDebug === undefined) {
            return false;
        }
        return sysDebug.toLowerCase() === 'true';
    }

    public static publishEventToCi(areaCode: string, message: string, tracePoint: number, isUserError: boolean) {
        const taskProps = { areacode: '', result: '', tracepoint: 0, isusererror: false };
        taskProps.areacode = areaCode;
        taskProps.result = message;
        taskProps.tracepoint = tracePoint;
        taskProps.isusererror = isUserError;
        ci.publishEvent(taskProps);
    }

    public static getXmlContents(filePath: string): Q.Promise<any> {
        const defer = Q.defer<any>();
        Helper.readFileContents(filePath, 'utf-8')
            .then(function (xmlContents) {
                parser.parseString(xmlContents, function (err, result) {
                    if (err) {
                        defer.resolve(null);
                    } else {
                        defer.resolve(result);
                    }
                });
            })
            .fail(function (err) {
                defer.reject(err);
            });
        return defer.promise;
    }

    public static saveToFile(fileContents: string, extension: string): Q.Promise<string> {
        const defer = Q.defer<string>();
        const tempFile = Helper.GenerateTempFile(uuid.v1() + extension);
        fs.writeFile(tempFile, fileContents, function (err) {
            if (err) {
                defer.reject(err);
            }
            tl.debug('Temporary file created at ' + tempFile);
            defer.resolve(tempFile);
        });
        return defer.promise;
    }

    public static GenerateTempFile(fileName: string): string {
        return path.join(Helper.GetTempFolder(), fileName);
    }

    public static GetTempFolder(): string {
        try {
            tl.assertAgent('2.115.0');
            const tmpDir =  tl.getVariable('Agent.TempDirectory');
            return tmpDir;
        } catch (err) {
            tl.warning(tl.loc('UpgradeAgentMessage'));
            return os.tmpdir();
        }
    }

    public static readFileContents(filePath: string, encoding: string): Q.Promise<string> {
        const defer = Q.defer<string>();
        fs.readFile(filePath, encoding, (err, data) => {
            if (err) {
                defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
            } else {
                defer.resolve(data);
            }
        });
        return defer.promise;
    }

    public static readFileContentsSync(filePath: string, encoding: string): string {
        return fs.readFileSync(filePath, encoding);
    }

    public static writeXmlFile(result: any, settingsFile: string, fileExt: string): Q.Promise<string> {
        const defer = Q.defer<string>();
        let runSettingsContent = builder.buildObject(result);
        runSettingsContent = str(runSettingsContent).replaceAll('&#xD;', '').s;
        //This is to fix carriage return any other special chars will not be replaced
        Helper.saveToFile(runSettingsContent, fileExt)
            .then(function (fileName) {
                defer.resolve(fileName);
                return defer.promise;
            })
            .fail(function (err) {
                defer.reject(err);
            });
        return defer.promise;
    }

    public static getVSVersion(versionNum: number) {
        switch (versionNum) {
            case 12: return '2013';
            case 14: return '2015';
            case 15: return '2017';
            default: return 'selected';
        }
    }

    public static printMultiLineLog(multiLineString: string, logFunction: Function) {
        const lines = multiLineString.toString().split('\n');
        lines.forEach(function (line: string) {
            if (line.trim().length === 0) {
                return;
            }
            logFunction(line);
        });
    }

    public static modifyVsTestConsoleArgsForResponseFile(argument: string): string {
        if (argument) {
            if (!argument.startsWith('/')) {
                return '\"' + argument + '\"';
            } else {
                // we need to add quotes to args we are passing after : as the arg value can have spaces
                // we dont need to changes the guy who is creating the args as toolrunner already takes care of this
                // for response file we need to take care of this ourselves
                // eg: /settings:c:\a b\1.settings should become /settings:"C:\a b\1.settings"
                let indexOfColon = argument.indexOf(':'); // find if args has ':'
                if (indexOfColon > 0 && argument[indexOfColon + 1] !== '\"') { // only process when quotes are not there
                    let modifyString = argument.substring(0, indexOfColon + 1); // get string till colon
                    modifyString = modifyString + '\"' + argument.substring(indexOfColon + 1) + '\"'; // append '"' and rest of the string
                    return modifyString;
                }
            }
        }

        return argument;
    }

    // set the console code page to "UTF-8"
    public static setConsoleCodePage() {
        tl.debug("Changing active code page to UTF-8");
        const chcp = tl.tool(path.resolve(process.env.windir, "system32", "chcp.com"));
        chcp.arg(["65001"]);
        chcp.execSync({ silent: true } as tr.IExecSyncOptions);
    }

    public static stringToBool(inputString : string) : boolean {
        return !this.isNullEmptyOrUndefined(inputString) && inputString.toLowerCase() === 'true';
    }

    public static uploadFile(file: string): void {
        try {
            if (Helper.pathExistsAsFile(file)) {
                const stats = fs.statSync(file);
                tl.debug('File exists. Size: ' + stats.size + ' Bytes');
                console.log('##vso[task.uploadfile]' + file);
            }
        } catch (err) {
            tl.debug(`Failed to upload file ${file} with error ${err}`);
        }
    }
}