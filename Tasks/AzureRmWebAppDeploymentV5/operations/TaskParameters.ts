import tl = require('azure-pipelines-task-lib/task');
import * as Constant from '../operations/Constants'
import { Package, PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
var webCommonUtility = require('azure-pipelines-tasks-webdeployment-common/utility.js');

export enum DeploymentType {
    webDeploy,
    zipDeploy,
    runFromZip,
    oneDeploy
}

type AdditionalArgumentsTelemetry = {
    deploymentMethod: DeploymentType;
    doubleQuoteCount: number;
    singleQuoteCount: number;
    escapeCharCount: number;
    spaceCharCount: number;
    totalArgs: number;
}
export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
            ConnectionType: tl.getInput('ConnectionType', true),
            WebAppKind: tl.getInput('WebAppKind', false),
            DeployToSlotOrASEFlag: tl.getBoolInput('DeployToSlotOrASEFlag', false),
            GenerateWebConfig: tl.getBoolInput('GenerateWebConfig', false),
            WebConfigParameters: tl.getInput('WebConfigParameters', false),
            XmlTransformation: tl.getBoolInput('XmlTransformation', false),
            JSONFiles: tl.getDelimitedInput('JSONFiles', '\n', false),
            XmlVariableSubstitution: tl.getBoolInput('XmlVariableSubstitution', false),
            TakeAppOfflineFlag: tl.getBoolInput('TakeAppOfflineFlag', false),
            RenameFilesFlag: tl.getBoolInput('RenameFilesFlag', false),
            AdditionalArguments: tl.getInput('AdditionalArguments', false),
            ScriptType: tl.getInput('ScriptType', false),
            InlineScript: tl.getInput('InlineScript', false),
            ScriptPath : tl.getPathInput('ScriptPath', false),
            DockerNamespace: tl.getInput('DockerNamespace', false),
            AppSettings: tl.getInput('AppSettings', false),
            StartupCommand: tl.getInput('StartupCommand', false),
            ConfigurationSettings: tl.getInput('ConfigurationSettings', false),
            //OneDeployParams
            OneDeployType: tl.getInput('type', false),
            Restart: tl.getBoolInput('restart', false),
            Clean: tl.getBoolInput('clean', false),
            IgnoreStack: tl.getBoolInput('ignorestack', false),
            TargetPath : tl.getInput('targetPath', false)
        }
        
        if(taskParameters.ConnectionType === Constant.ConnectionType.PublishProfile) {
            this._initializeDefaultParametersForPublishProfile(taskParameters);
            return taskParameters;
        }

        taskParameters.connectedServiceName = tl.getInput('ConnectedServiceName', true);
        taskParameters.WebAppName = tl.getInput('WebAppName', true);
        taskParameters.isFunctionApp = taskParameters.WebAppKind.indexOf("function") != -1;
        taskParameters.isLinuxApp = taskParameters.WebAppKind && (taskParameters.WebAppKind.indexOf("Linux") !=-1 || taskParameters.WebAppKind.indexOf("Container") != -1);
        taskParameters.isHyperVContainerApp = taskParameters.WebAppKind && (taskParameters.WebAppKind.toLowerCase().indexOf("hyperv") !=-1 && taskParameters.WebAppKind.toLowerCase().indexOf("container") != -1);
        taskParameters.isBuiltinLinuxWebApp = taskParameters.WebAppKind.indexOf('Linux') != -1;
        taskParameters.isContainerWebApp =taskParameters.WebAppKind.indexOf('Container') != -1;
        taskParameters.ResourceGroupName = taskParameters.DeployToSlotOrASEFlag ? tl.getInput('ResourceGroupName', false) : null;
        taskParameters.SlotName = taskParameters.DeployToSlotOrASEFlag ? tl.getInput('SlotName', false) : null;

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);
        
        if(!taskParameters.isContainerWebApp){            
            taskParameters.Package = new Package(tl.getPathInput('Package', true));
            tl.debug("intially web config parameters :" + taskParameters.WebConfigParameters);
            if(taskParameters.Package.getPackageType() === PackageType.jar && (!taskParameters.isLinuxApp)) {
                if(!taskParameters.WebConfigParameters) {
                    taskParameters.WebConfigParameters = "-appType java_springboot";
                }
                if(taskParameters.WebConfigParameters.indexOf("-appType java_springboot") < 0) {
                    taskParameters.WebConfigParameters += " -appType java_springboot";
                }
                if(taskParameters.WebConfigParameters.indexOf("-JAR_PATH D:\\home\\site\\wwwroot\\*.jar") >= 0) {
                    var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                    taskParameters.WebConfigParameters = taskParameters.WebConfigParameters.replace("D:\\home\\site\\wwwroot\\*.jar", jarPath);
                } else if(taskParameters.WebConfigParameters.indexOf("-JAR_PATH ") < 0) {
                    var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                    taskParameters.WebConfigParameters += " -JAR_PATH " + jarPath;
                }
                if(taskParameters.WebConfigParameters.indexOf("-Dserver.port=%HTTP_PLATFORM_PORT%") > 0) {
                    taskParameters.WebConfigParameters = taskParameters.WebConfigParameters.replace("-Dserver.port=%HTTP_PLATFORM_PORT%", "");  
                }
                tl.debug("web config parameters :" + taskParameters.WebConfigParameters);
            }
        }
          
        taskParameters.UseWebDeploy = !taskParameters.isLinuxApp ? tl.getBoolInput('UseWebDeploy', false) : false;

        if(taskParameters.isLinuxApp && taskParameters.isBuiltinLinuxWebApp) {
            if(taskParameters.isFunctionApp) {
                taskParameters.RuntimeStack = tl.getInput('RuntimeStackFunction', false);
            }
            else {
                taskParameters.RuntimeStack = tl.getInput('RuntimeStack', false);
            }
            taskParameters.TakeAppOfflineFlag = false;
        }
        if (!taskParameters.isFunctionApp && !taskParameters.isLinuxApp) {
            taskParameters.VirtualApplication = tl.getInput('VirtualApplication', false);
            taskParameters.VirtualApplication = taskParameters.VirtualApplication && taskParameters.VirtualApplication.startsWith('/') 
                ? taskParameters.VirtualApplication.substr(1) : taskParameters.VirtualApplication;
        }

        if(taskParameters.UseWebDeploy) {
            taskParameters.DeploymentType = this.getDeploymentType(tl.getInput('DeploymentType', false));
            if(taskParameters.DeploymentType == DeploymentType.webDeploy) {                
                taskParameters.RemoveAdditionalFilesFlag = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
                taskParameters.SetParametersFile = tl.getPathInput('SetParametersFile', false);
                taskParameters.ExcludeFilesFromAppDataFlag = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false)
                taskParameters.AdditionalArguments = tl.getInput('AdditionalArguments', false) || '';
            }
        }
        else {
            // Retry Attempt is passed by default
            taskParameters.AdditionalArguments = '-retryAttempts:6 -retryInterval:10000';
        }
        if (taskParameters.DeploymentType === DeploymentType.runFromZip) {
            taskParameters.TakeAppOfflineFlag = false;
        }

        if(taskParameters.isLinuxApp && taskParameters.ScriptType) {
            this.UpdateLinuxAppTypeScriptParameters(taskParameters);
        }

        try {
            var additionalArgsTelemetry = this._getAdditionalArgumentsTelemetry(taskParameters.AdditionalArguments, taskParameters.DeploymentType);
            console.log("##vso[telemetry.publish area=AdditionalArgumentsVerification;feature=AzureRmWebAppDeployment]" + JSON.stringify(additionalArgsTelemetry));
        } catch (error) {
            // Ignore errors in telemetry
        };

        return taskParameters;
    }

    private static _initializeDefaultParametersForPublishProfile(taskParameters: TaskParameters): void {
        taskParameters.PublishProfilePath = tl.getInput('PublishProfilePath', true);
        taskParameters.PublishProfilePassword = tl.getInput('PublishProfilePassword', true);
        taskParameters.Package = new Package(tl.getPathInput('Package', true));
        taskParameters.AdditionalArguments = "-retryAttempts:6 -retryInterval:10000";
    }

    private static UpdateLinuxAppTypeScriptParameters(taskParameters: TaskParameters) {
        let retryTimeoutValue = tl.getVariable('appservicedeploy.retrytimeout');
        let timeoutAppSettings = retryTimeoutValue ? Number(retryTimeoutValue) * 60 : 1800;

        tl.debug(`setting app setting SCM_COMMAND_IDLE_TIMEOUT to ${timeoutAppSettings}`);
        if(taskParameters.AppSettings) {
            taskParameters.AppSettings = `-SCM_COMMAND_IDLE_TIMEOUT ${timeoutAppSettings} ` + taskParameters.AppSettings;
        }
        else {
            taskParameters.AppSettings = `-SCM_COMMAND_IDLE_TIMEOUT ${timeoutAppSettings}`;
        }
    }
    
    private static getDeploymentType(type): DeploymentType {
        switch(type) {
            case "webDeploy": return DeploymentType.webDeploy;
            case "zipDeploy": return DeploymentType.zipDeploy;
            case "runFromZip": return DeploymentType.runFromZip;
            case "oneDeploy": return DeploymentType.oneDeploy;
        }
    }

    private static _getAdditionalArgumentsTelemetry(additionalArguments: string, deploymentType: DeploymentType): AdditionalArgumentsTelemetry {
        const telemetry = {
            deploymentMethod: deploymentType,
            doubleQuoteCount: 0,
            singleQuoteCount: 0,
            escapeCharCount: 0,
            spaceCharCount: 0,
            totalArgs: 0
        }

        if (!additionalArguments) return telemetry;

        const parsedArgs = this.parseAdditionalArguments(additionalArguments);
        const escapedChars = new RegExp(/[\\\^\.\*\?\-\&\|\(\)\<\>\t\n\r\f]/);
        const separator = ",";

        parsedArgs.forEach(function (arg) {
            let formattedArg = '';
            let equalsSignEncountered = false;
            for (let i = 0; i < arg.length; i++) {
                const char = arg.charAt(i);
                if (char == separator && equalsSignEncountered) {
                    equalsSignEncountered = false;
                    if (formattedArg.startsWith('"') && formattedArg.endsWith('"')) telemetry.doubleQuoteCount++;
                    if (formattedArg.startsWith("'") && formattedArg.endsWith("'")) telemetry.singleQuoteCount++;
                    if (escapedChars.test(formattedArg)) telemetry.escapeCharCount++;
                    if (/\s+/.test(formattedArg)) telemetry.spaceCharCount++;

                    telemetry.totalArgs++;
                    formattedArg = '';
                    continue;
                }
                if (equalsSignEncountered) {
                    formattedArg += char;
                } 
                if (char == '=') {
                    equalsSignEncountered = true;
                } 
            };

            if (formattedArg.length > 0) {
                if (formattedArg.startsWith('"') && formattedArg.endsWith('"')) telemetry.doubleQuoteCount++;
                if (formattedArg.startsWith("'") && formattedArg.endsWith("'")) telemetry.singleQuoteCount++;
                if (escapedChars.test(formattedArg)) telemetry.escapeCharCount++;
                if (/\s+/.test(formattedArg)) telemetry.spaceCharCount++;


                telemetry.totalArgs++;;
            }
        });

        return telemetry;
    }

    /**
     * Parses additional arguments for the msdeploy command-line utility.
     * @param {string} additionalArguments - The additional arguments to parse.
     * @returns {string[]} An array of parsed arguments.
     */
    private static parseAdditionalArguments(additionalArguments: string): string[] {
        var parsedArgs = [];
        var isInsideQuotes = false;
        for (let i = 0; i < additionalArguments.length; i++) {
            var arg = '';
            var qouteSymbol = '';
            let char = additionalArguments.charAt(i);
            // command parse start
            if (char === '-') {
                while (i < additionalArguments.length) {
                    char = additionalArguments.charAt(i);
                    const prevSym = additionalArguments.charAt(i - 1);
                    // If we reach space and we are not inside quotes, then it is the end of the argument
                    if (char === ' ' && !isInsideQuotes) break;
                    // If we reach unescaped comma and we inside qoutes we assume that it is the end of quoted line
                    if (isInsideQuotes && char === qouteSymbol &&  prevSym !== '\\') {
                        isInsideQuotes = false;
                        qouteSymbol = '';
                    // If we reach unescaped comma and we are not inside qoutes we assume that it is the beggining of quoted line
                    } else if (!isInsideQuotes && (char === '"' || char === "'") &&  prevSym !== '\\') {
                        isInsideQuotes = !isInsideQuotes;
                        qouteSymbol = char;
                    }

                    arg += char;
                    i += 1;
                }
                parsedArgs.push(arg);
            }
        }
        return parsedArgs;
    }
}

export interface TaskParameters {
    ConnectionType: string;
    connectedServiceName?: string;
    PublishProfilePath?: string;
    PublishProfilePassword?: string;
    WebAppName?: string;
    WebAppKind?: string;
    DeployToSlotOrASEFlag?: boolean;
    ResourceGroupName?: string;
    SlotName?: string;
    VirtualApplication?: string;
    Package?: Package;
    GenerateWebConfig?: boolean;
    WebConfigParameters?: string;
    XmlTransformation?: boolean;
    JSONFiles?: string[];
    XmlVariableSubstitution?: boolean;
    UseWebDeploy?: boolean;
    DeploymentType?: DeploymentType;
    RemoveAdditionalFilesFlag?: boolean;
    SetParametersFile?: string;
    ExcludeFilesFromAppDataFlag?: boolean;
    TakeAppOfflineFlag?: boolean;
    RenameFilesFlag?: boolean;
    AdditionalArguments?: string;
    ScriptType?: string;
    InlineScript?: string;
    ScriptPath ?: string;
    DockerNamespace?: string;
    AppSettings?: string;
    StartupCommand?: string;
    RuntimeStack?: string;
    ConfigurationSettings?: string;
    /** Additional parameters */
    isLinuxApp?: boolean;
    isHyperVContainerApp?: boolean;
    isBuiltinLinuxWebApp?: boolean;
    isContainerWebApp?: boolean;
    isFunctionApp?: boolean;
    /** OneDeploy parameters */
    OneDeployType?: string;
    Restart?: boolean;
    Clean?: boolean;
    IgnoreStack?: boolean;
    TargetPath ?: string;
}
