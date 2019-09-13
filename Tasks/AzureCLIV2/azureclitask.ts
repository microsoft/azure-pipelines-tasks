import {IExecSyncResult} from "azure-pipelines-task-lib/ToolRunner";
import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");

export class azureclitask {

    public static async runMain(): Promise<void> {
        var toolExecutionError = null;
        try{
            var scriptType: ScriptType = ScriptTypeFactory.getSriptType();
            var tool: any = await scriptType.getTool();
            var cwd: string = tl.getPathInput("cwd", true, false);
            if (tl.getInput("scriptLocation").toLowerCase() === "scriptPath" && !tl.filePathSupplied("cwd")) {
                cwd = path.dirname(tl.getPathInput("scriptPath", true, true));
            }
            // determines whether output to stderr will fail a task.
            // some tools write progress and other warnings to stderr.  scripts can also redirect.
            var failOnStdErr: boolean = tl.getBoolInput("failOnStandardError", false);

            tl.mkdirP(cwd);
            tl.cd(cwd);
            Util.throwIfError(tl.execSync("az", "--version"));
            // set az cli config dir
            this.setConfigDirectory();
            this.setAzureCloudBasedOnServiceEndpoint();
            var connectedService: string = tl.getInput("connectedServiceNameARM", true);
            this.loginAzureRM(connectedService);

            var addSpnToEnvironment: boolean = tl.getBoolInput("addSpnToEnvironment", false);
            if (!!addSpnToEnvironment && tl.getEndpointAuthorizationScheme(connectedService, true) == "ServicePrincipal") {
                await tool.exec({
                    failOnStdErr: failOnStdErr,
                    env: { ...process.env, ...{ servicePrincipalId: this.servicePrincipalId, servicePrincipalKey: this.servicePrincipalKey, tenantId: this.tenantId } }
                });
            }
            else {
                await tool.exec({ failOnStdErr: failOnStdErr });
            }
        }
        catch (err) {
            toolExecutionError = err;
            if (err.stderr) {
                toolExecutionError = err.stderr;
            }
        }
        finally {
            await scriptType.cleanUp();
            if (this.cliPasswordPath) {
                tl.debug('Removing spn certificate file');
                tl.rmRF(this.cliPasswordPath);
            }

            //set the task result to either succeeded or failed based on error was thrown or not
            if (toolExecutionError) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ScriptFailed", toolExecutionError));
            }
            else {
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("ScriptReturnCode", 0));
            }

            //Logout of Azure if logged in
            if (this.isLoggedIn) {
                this.logoutAzure();
            }
        }
    }

    private static isLoggedIn: boolean = false;
    private static cliPasswordPath: string = null;
    private static servicePrincipalId: string = null;
    private static servicePrincipalKey: string = null;
    private static tenantId: string = null;

    private static loginAzureRM(connectedService: string): void {
        var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        var subscriptionID: string = tl.getEndpointDataParameter(connectedService, "SubscriptionID", true);

        if(authScheme.toLowerCase() == "serviceprincipal") {
            let authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let cliPassword: string = null;
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            this.servicePrincipalId = servicePrincipalId;
            this.tenantId = tenantId;

            if (authType == "spnCertificate") {
                tl.debug('certificate based endpoint');
                let certificateContent: string = tl.getEndpointAuthorizationParameter(connectedService, "servicePrincipalCertificate", false);
                cliPassword = path.join(tl.getVariable('Agent.TempDirectory') || tl.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
                fs.writeFileSync(cliPassword, certificateContent);
                this.cliPasswordPath = cliPassword;
            }
            else {
                tl.debug('key based endpoint');
                cliPassword = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
                this.servicePrincipalKey = cliPassword;
            }

            //login using svn
            Util.throwIfError(tl.execSync("az", "login --service-principal -u \"" + servicePrincipalId + "\" -p \"" + cliPassword + "\" --tenant \"" + tenantId + "\""), tl.loc("LoginFailed"));
        }
        else if(authScheme.toLowerCase() == "managedserviceidentity") {
            //login using msi
            Util.throwIfError(tl.execSync("az", "login --identity"), tl.loc("MSILoginFailed"));
        }
        else{
            throw tl.loc('AuthSchemeNotSupported', authScheme);
        }

        this.isLoggedIn = true;
        //set the subscription imported to the current subscription
        Util.throwIfError(tl.execSync("az", "account set --subscription \"" + subscriptionID + "\""), tl.loc("ErrorInSettingUpSubscription"));
    }

    private static setConfigDirectory(): void {
        if (tl.getBoolInput("useGlobalConfig")) {
            return;
        }

        if (!!tl.getVariable('Agent.TempDirectory')) {
            var azCliConfigPath = path.join(tl.getVariable('Agent.TempDirectory'), ".azclitask");
            console.log(tl.loc('SettingAzureConfigDir', azCliConfigPath));
            process.env['AZURE_CONFIG_DIR'] = azCliConfigPath;
        } else {
            console.warn(tl.loc('GlobalCliConfigAgentVersionWarning'));
        }
    }

    private static setAzureCloudBasedOnServiceEndpoint(): void {
        var connectedService: string = tl.getInput("connectedServiceNameARM", true);
        var environment = tl.getEndpointDataParameter(connectedService, 'environment', true);
        if(!!environment) {
            console.log(tl.loc('SettingAzureCloud', environment));
            Util.throwIfError(tl.execSync("az", "cloud set -n " + environment));
        }
    }

    private static logoutAzure() {
        try {
            tl.execSync("az", " account clear");
        }
        catch (err) {
            // task should not fail if logout doesn`t occur
            tl.warning(tl.loc("FailedToLogout"));
        }
    }
}

class ScriptTypeFactory {
    public static getSriptType(): ScriptType {
        let scriptType: string = tl.getInput("scriptType");
        let scriptLocation: string = tl.getInput("scriptLocation");
        let scriptArguments: string = tl.getInput("scriptArguments", false);
        switch(scriptType){
            case 'ps': 
                return new PowerShell5(scriptLocation, scriptArguments);
            case 'pscore': 
                return new PowerShell6(scriptLocation, scriptArguments);
            case 'bash': 
                return new Bash(scriptLocation, scriptArguments);
            case 'batch':
            default: 
                return new Batch(scriptLocation, scriptArguments);
        }
    }
}

abstract class ScriptType {

    protected _scriptLocation: string;
    protected _scriptArguments: string;
    protected _scriptPath: string;

    constructor(scriptLocation: string, scriptArguments: string) {
        this._scriptLocation = scriptLocation;
        this._scriptArguments = scriptArguments;
    }

    public abstract async getTool(): Promise<any>;

    public async cleanUp(): Promise<void> {
        if(this._scriptLocation === "inlineScript"){
            await Util.deleteFile(this._scriptPath);
        }
    }
}

class PowerShell5 extends ScriptType {

    public async getTool(): Promise<any> {
        this._scriptPath = await Util.getPowerShellScriptPath(this._scriptLocation, 'ps1', this._scriptArguments);
        let tool: any = tl.tool(tl.which('powershell', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-Command')
            .arg(`. '${this._scriptPath.replace("'", "''")}'`);
        return tool;
    }

    public async cleanUp(): Promise<void> {
        await Util.deleteFile(this._scriptPath);
    }
}

class PowerShell6 extends ScriptType {

    public async getTool(): Promise<any> {
        this._scriptPath = await Util.getPowerShellScriptPath(this._scriptLocation, 'ps1', this._scriptArguments);
        let tool: any = tl.tool(tl.which('pwsh', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-Command')
            .arg(`. '${this._scriptPath.replace("'", "''")}'`);
        return tool;
    }

    public async cleanUp(): Promise<void> {
        await Util.deleteFile(this._scriptPath);
    }

}

class Bash extends ScriptType {

    public async getTool(): Promise<any> {
        this._scriptPath = await Util.getScriptPath(this._scriptLocation, 'sh');
        let tool: any = tl.tool(tl.which("bash", true));
        tool.arg(this._scriptPath);
        tool.line(this._scriptArguments); // additional scriptArguments should always call line. line() parses quoted arg strings
        return tool;
    }
}

class Batch extends ScriptType {

    public async getTool(): Promise<any> {
        this._scriptPath = await Util.getScriptPath(this._scriptLocation, 'bat');
        let tool: any = tl.tool(tl.which(this._scriptPath, true));
        tool.line(this._scriptArguments); // additional scriptArguments should always call line. line() parses quoted arg strings
        return tool;
    }
}


class Util {

    public static async getScriptPath(scriptLocation:string, fileExtension:string): Promise<string> {
        if (scriptLocation === "scriptPath") {
            let filePath: string = tl.getPathInput("scriptPath", true, true);
            if(Util.checkIfFileExists(filePath, fileExtension)){
                return filePath;
            }
            throw new Error(tl.loc('JS_InvalidFilePath', filePath));
        }
        let tmpDir = tl.getVariable('Agent.TempDirectory') || os.tmpdir();
        let inlineScript: string = tl.getInput("inlineScript", true);
        let scriptPath: string = path.join(tmpDir, `azureclitaskscript${new Date().getTime()}.${fileExtension}`);
        await Util.createFile(scriptPath, inlineScript);
        return scriptPath;
    }

    public static async getPowerShellScriptPath(scriptLocation: string, fileExtension: string, scriptArguments: string): Promise<string> {
        let powerShellErrorActionPreference: string = tl.getInput('powerShellErrorActionPreference', false) || 'Stop';
            switch (powerShellErrorActionPreference.toUpperCase()) {
                case 'STOP':
                case 'CONTINUE':
                case 'SILENTLYCONTINUE':
                    break;
                default:
                    throw new Error(tl.loc('JS_InvalidErrorActionPreference', powerShellErrorActionPreference));
            }

        let contents: string[] = [];
        contents.push(`$ErrorActionPreference = '${powerShellErrorActionPreference}'`); 

        if (scriptLocation === "scriptPath") {
            let filePath: string = tl.getPathInput("scriptPath", true, true);
            if (Util.checkIfFileExists(filePath, fileExtension)){
                contents.push(`. '${filePath.replace("'", "''")}' ${scriptArguments}`.trim());
            }
            else{
                throw new Error(tl.loc('JS_InvalidFilePath', filePath));
            }
        }
        else {
            let inlineScript: string = tl.getInput("inlineScript", true);
            contents.push(inlineScript);
        }
        let powerShellIgnoreLASTEXITCODE: string = tl.getInput('powerShellIgnoreLASTEXITCODE', false);
        if (!powerShellIgnoreLASTEXITCODE) {
            contents.push(`if (!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {`);
            contents.push(`    Write-Host '##vso[task.debug]$LASTEXITCODE is not set.'`);
            contents.push(`} else {`);
            contents.push(`    Write-Host ('##vso[task.debug]$LASTEXITCODE: {0}' -f $LASTEXITCODE)`);
            contents.push(`    exit $LASTEXITCODE`);
            contents.push(`}`);
        }

        // Write the script to disk.
        tl.assertAgent('2.115.0');
        let tempDirectory = tl.getVariable('agent.tempDirectory');
        tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
        let scriptPath: string = path.join(tempDirectory, `azureclitaskscript${new Date().getTime()}.${fileExtension}`);

        await Util.createFile(scriptPath,'\ufeff' + contents.join(os.EOL), 'utf8' );
        return scriptPath;
    }

    public static checkIfAzurePythonSdkIsInstalled() {
        return !!tl.which("az", false);
    }

    public static throwIfError(resultOfToolExecution: IExecSyncResult, errormsg?: string): void {
        if (resultOfToolExecution.code != 0) {
            tl.error("Error Code: [" + resultOfToolExecution.code + "]");
            if (errormsg) {
                tl.error("Error: " + errormsg);
            }
            throw resultOfToolExecution;
        }
    }

    public static async createFile(filePath: string, data: string, options?:string): Promise<void> {
        try {
            fs.writeFileSync(filePath, data, options);
        }
        catch (err) {
            Util.deleteFile(filePath);
            throw err;
        }
    }

    public static checkIfFileExists(filePath: string, fileExtension: string): boolean {
        if (!tl.stats(filePath).isFile() || !filePath.toUpperCase().match(new RegExp(`\.${fileExtension.toUpperCase()}$`))) {
            return false;
        }
        return true;
    }

    public static async deleteFile(filePath: string): Promise<void> {
        if (fs.existsSync(filePath)) {
            try {
                //delete the publishsetting file created earlier
                fs.unlinkSync(filePath);
            }
            catch (err) {
                //error while deleting should not result in task failure
                console.error(err.toString());
            }
        }
    }
}

tl.setResourcePath(path.join(__dirname, "task.json"));

if (!Util.checkIfAzurePythonSdkIsInstalled()) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("AzureSDKNotFound"));
}

azureclitask.runMain();