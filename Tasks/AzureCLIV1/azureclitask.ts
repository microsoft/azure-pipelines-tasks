import { IExecSyncResult } from 'vsts-task-lib/toolrunner';
import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");

export class azureclitask {
    public static checkIfAzurePythonSdkIsInstalled() {
        return !!tl.which("az", false);
    }

    public static async runMain() {
        var toolExecutionError = null;
        try {
            var tool;
            if (os.type() != "Windows_NT") {
                tool = tl.tool(tl.which("bash", true));
            }

            var scriptLocation: string = tl.getInput("scriptLocation");
            var scriptPath: string = null;
            var cwd: string = tl.getPathInput("cwd", true, false);

            if (scriptLocation === "scriptPath") {
                scriptPath = tl.getPathInput("scriptPath", true, true);
                // if user didn"t supply a cwd (advanced), then set cwd to folder script is in.
                // All "script" tasks should do this
                if (!tl.filePathSupplied("cwd")) {
                    cwd = path.dirname(scriptPath);
                }
            }
            else {
                var tmpDir = tl.getVariable('Agent.TempDirectory') || os.tmpdir();
                var script: string = tl.getInput("inlineScript", true);
                if (os.type() != "Windows_NT") {
                    scriptPath = path.join(tmpDir, "azureclitaskscript" + new Date().getTime() + ".sh");
                }
                else {
                    scriptPath = path.join(tmpDir, "azureclitaskscript" + new Date().getTime() + ".bat");
                }
                this.createFile(scriptPath, script);
            }

            var args = tl.getInput("args", false);

            // determines whether output to stderr will fail a task.
            // some tools write progress and other warnings to stderr.  scripts can also redirect.
            var failOnStdErr = tl.getBoolInput("failOnStandardError", false);

            tl.mkdirP(cwd);
            tl.cd(cwd);

            if (os.type() != "Windows_NT") {
                tool.arg(scriptPath);
            }
            else {
                tool = tl.tool(tl.which(scriptPath, true));
            }
            this.throwIfError(tl.execSync("az", "--version"));
            // set az cli config dir
            this.setConfigDirectory();
            this.setAzureCloudBasedOnServiceEndpoint();
            var connectedService: string = tl.getInput("connectedServiceNameARM", true);
            this.loginAzureRM(connectedService);

            tool.line(args); // additional args should always call line. line() parses quoted arg strings

            var addSpnToEnvironment = tl.getBoolInput("addSpnToEnvironment", false);
            if (!!addSpnToEnvironment && tl.getEndpointAuthorizationScheme(connectedService, true) == "ServicePrincipal") {
                await tool.exec({
                    failOnStdErr: failOnStdErr,
                    env: { ...process.env, ...{ servicePrincipalId: this.servicePrincipalId, servicePrincipalKey: this.servicePrincipalKey } }
                });
            }
            else {
                await tool.exec({ failOnStdErr: failOnStdErr });
            }

        }
        catch (err) {
            if (err.stderr) {
                toolExecutionError = err.stderr;
            }
            else {
                toolExecutionError = err;
            }
            //go to finally and logout of azure and set task result
        }
        finally {
            if (scriptLocation === "inlineScript") {
                this.deleteFile(scriptPath);
            }

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

    private static loginAzureRM(connectedService: string): void {
        var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        var subscriptionID: string = tl.getEndpointDataParameter(connectedService, "SubscriptionID", true);

        if(authScheme.toLowerCase() == "serviceprincipal") {
            let authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let cliPassword: string = null;
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
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
                this.servicePrincipalId = servicePrincipalId;
                this.servicePrincipalKey = cliPassword;
            }

            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            //login using svn
            this.throwIfError(tl.execSync("az", "login --service-principal -u \"" + servicePrincipalId + "\" -p \"" + cliPassword + "\" --tenant \"" + tenantId + "\""), tl.loc("LoginFailed"));
        }
        else if(authScheme.toLowerCase() == "managedserviceidentity") {
            //login using msi
            this.throwIfError(tl.execSync("az", "login --identity"), tl.loc("MSILoginFailed"));
        }
        else{
            throw tl.loc('AuthSchemeNotSupported', authScheme);
        }

        this.isLoggedIn = true;
        //set the subscription imported to the current subscription
        this.throwIfError(tl.execSync("az", "account set --subscription \"" + subscriptionID + "\""), tl.loc("ErrorInSettingUpSubscription"));
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
            this.throwIfError(tl.execSync("az", "cloud set -n " + environment));
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

    private static throwIfError(resultOfToolExecution: IExecSyncResult, errormsg?: string): void {
        if (resultOfToolExecution.code != 0) {
            tl.error("Error Code: [" + resultOfToolExecution.code + "]");
            if (errormsg) {
                tl.error("Error: " + errormsg);
            }
            throw resultOfToolExecution;
        }
    }

    private static createFile(filePath: string, data: string) {
        try {
            fs.writeFileSync(filePath, data);
        }
        catch (err) {
            this.deleteFile(filePath);
            throw err;
        }
    }

    private static deleteFile(filePath: string): void {
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

if (!azureclitask.checkIfAzurePythonSdkIsInstalled()) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("AzureSDKNotFound"));
}

azureclitask.runMain();
