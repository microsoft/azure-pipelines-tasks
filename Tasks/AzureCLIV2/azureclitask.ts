import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import { Utility } from "./src/Utility";
import { ScriptType, ScriptTypeFactory } from "./src/ScriptType";
import { getSystemAccessToken } from 'azure-pipelines-tasks-artifacts-common/webapi';
import { getHandlerFromToken, WebApi } from "@starkmsu/azure-devops-node-api/api/WebApi";
import { ITaskApi } from "@starkmsu/azure-devops-node-api/api/TaskApi";

const FAIL_ON_STDERR: string = "FAIL_ON_STDERR";

export class azureclitask {

    public static async runMain(): Promise<void> {
        var toolExecutionError = null;
        var exitCode: number = 0;
        try{
            var scriptType: ScriptType = ScriptTypeFactory.getSriptType();
            var tool: any = await scriptType.getTool();
            var cwd: string = tl.getPathInput("cwd", true, false);
            if (tl.getInput("scriptLocation", true).toLowerCase() === "scriptPath" && !tl.filePathSupplied("cwd")) {
                cwd = path.dirname(tl.getPathInput("scriptPath", true, true));
            }
            // determines whether output to stderr will fail a task.
            // some tools write progress and other warnings to stderr.  scripts can also redirect.
            var failOnStdErr: boolean = tl.getBoolInput("failOnStandardError", false);

            tl.mkdirP(cwd);
            tl.cd(cwd);
            Utility.throwIfError(tl.execSync("az", "--version"));
            // set az cli config dir
            this.setConfigDirectory();
            this.setAzureCloudBasedOnServiceEndpoint();
            var connectedService: string = tl.getInput("connectedServiceNameARM", true);
            await this.loginAzureRM(connectedService);

            let errLinesCount: number = 0;
            let aggregatedErrorLines: string[] = [];
            tool.on('errline', (errorLine: string) => {
                if (errLinesCount < 10) {
                    aggregatedErrorLines.push(errorLine);
                }
                errLinesCount++;
            });

            var addSpnToEnvironment: boolean = tl.getBoolInput("addSpnToEnvironment", false);
            if (!!addSpnToEnvironment && tl.getEndpointAuthorizationScheme(connectedService, true).toLowerCase() == "serviceprincipal") {
                exitCode = await tool.exec({
                    failOnStdErr: false,
                    ignoreReturnCode: true,
                    env: { ...process.env, ...{ servicePrincipalId: this.servicePrincipalId, servicePrincipalKey: this.servicePrincipalKey, tenantId: this.tenantId } }
                });
            }
            else {
                exitCode = await tool.exec({
                    failOnStdErr: false,
                    ignoreReturnCode: true
                 });
            }


            if (failOnStdErr && aggregatedErrorLines.length > 0) {
                let error = FAIL_ON_STDERR;
                tl.error(aggregatedErrorLines.join("\n"));
                throw error;
            }
        }
        catch (err) {
            toolExecutionError = err;
            if (err.stderr) {
                toolExecutionError = err.stderr;
            }
        }
        finally {
            if (scriptType) {
                await scriptType.cleanUp();
            }

            if (this.cliPasswordPath) {
                tl.debug('Removing spn certificate file');
                tl.rmRF(this.cliPasswordPath);
            }

            //set the task result to either succeeded or failed based on error was thrown or not
            if(toolExecutionError === FAIL_ON_STDERR) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ScriptFailedStdErr"));
            } else if (toolExecutionError) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ScriptFailed", toolExecutionError));
            } else if (exitCode != 0){
                tl.setResult(tl.TaskResult.Failed, tl.loc("ScriptFailedWithExitCode", exitCode));
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

    private static async loginAzureRM(connectedService: string):Promise<void> {
        var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        var subscriptionID: string = tl.getEndpointDataParameter(connectedService, "SubscriptionID", true);

        if (authScheme.toLowerCase() == "oidcfederation") {
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            tl.debug(`serviceprincipalid: ${servicePrincipalId}`);
            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
            tl.debug(`tenantId: ${tenantId}`);

            const federatedToken = await this.getIdToken(connectedService);
            tl.debug(`IdToken: ${federatedToken}`);
            const args = `login --service-principal -u "${servicePrincipalId}" --tenant "${tenantId}" --allow-no-subscriptions --federated-token "${federatedToken}"`;

            //login using OpenID Connect federation
            Utility.throwIfError(tl.execSync("az", args), tl.loc("LoginFailed"));
        }
        else if (authScheme.toLowerCase() == "serviceprincipal") {
            let authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let cliPassword: string = null;
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            this.servicePrincipalId = servicePrincipalId;
            this.tenantId = tenantId;

            let args = `login --service-principal -u "${servicePrincipalId}" --tenant "${tenantId}" --allow-no-subscriptions `;

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

            let escapedCliPassword = cliPassword.replace(/"/g, '\\"');
            tl.setSecret(escapedCliPassword.replace(/\\/g, '\"'));
            //login using svn
            Utility.throwIfError(tl.execSync("az", `login --service-principal -u "${servicePrincipalId}" --password="${escapedCliPassword}" --tenant "${tenantId}" --allow-no-subscriptions`), tl.loc("LoginFailed"));
        }
        else if(authScheme.toLowerCase() == "managedserviceidentity") {
            //login using msi
            Utility.throwIfError(tl.execSync("az", "login --identity"), tl.loc("MSILoginFailed"));
        }
        else {
            throw tl.loc('AuthSchemeNotSupported', authScheme);
        }

        this.isLoggedIn = true;
        if (!!subscriptionID) {
            //set the subscription imported to the current subscription
            Utility.throwIfError(tl.execSync("az", "account set --subscription \"" + subscriptionID + "\""), tl.loc("ErrorInSettingUpSubscription"));
        }
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
        if (!!environment) {
            console.log(tl.loc('SettingAzureCloud', environment));
            Utility.throwIfError(tl.execSync("az", "cloud set -n " + environment));
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

    private static async getIdToken(connectedService: string) : Promise<string> {
        const jobId = tl.getVariable("System.JobId");
        tl.debug(`jobId: ${jobId}`);
        const planId = tl.getVariable("System.PlanId");
        tl.debug(`planId: ${planId}`);
        const projectId = tl.getVariable("System.TeamProjectId");
        tl.debug(`projectId: ${projectId}`);
        const hub = tl.getVariable("System.HostType");
        tl.debug(`hub: ${hub}`);
        const uri = tl.getVariable("system.collectionUri");
        tl.debug(`uri: ${uri}`);
        const token = getSystemAccessToken();
        tl.debug(`token: ${token}`);

        const authHandler = getHandlerFromToken(token);
        const connection = new WebApi(uri, authHandler);
        const api: ITaskApi = await connection.getTaskApi();

        const response = await api.createIdToken({"Key":"id","Value":"50"}, projectId, hub, planId, jobId, connectedService);
        if (response == null) {
            return null;
        }

        return response.idToken;
    }
}

tl.setResourcePath(path.join(__dirname, "task.json"));

if (!Utility.checkIfAzurePythonSdkIsInstalled()) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("AzureSDKNotFound"));
}

azureclitask.runMain();
