import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import { Utility } from "./src/Utility";
import { ScriptType, ScriptTypeFactory } from "./src/ScriptType";
import { getSystemAccessToken } from 'azure-pipelines-tasks-artifacts-common/webapi';
import { getHandlerFromToken, WebApi } from "azure-devops-node-api";
import { ITaskApi } from "azure-devops-node-api/TaskApi";

const FAIL_ON_STDERR: string = "FAIL_ON_STDERR";

export class azureclitask {

    public static async runMain(): Promise<void> {
        var toolExecutionError = null;
        var exitCode: number = 0;

        if(tl.getBoolFeatureFlag('AZP_AZURECLIV2_SETUP_PROXY_ENV')) {
            const proxyConfig: tl.ProxyConfiguration | null = tl.getHttpProxyConfiguration();
            if (proxyConfig) {
                process.env['HTTP_PROXY'] = proxyConfig.proxyFormattedUrl;
                process.env['HTTPS_PROXY'] = proxyConfig.proxyFormattedUrl;
                tl.debug(tl.loc('ProxyConfig', proxyConfig.proxyUrl));
            }
        }

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

            var addSpnToEnvironment: boolean = tl.getBoolInput('addSpnToEnvironment', false);
            var authorizationScheme = tl.getEndpointAuthorizationScheme(connectedService, true).toLowerCase();
            if (!!addSpnToEnvironment && authorizationScheme == 'serviceprincipal') {
                exitCode = await tool.exec({
                    failOnStdErr: false,
                    ignoreReturnCode: true,
                    env: {
                    ...process.env,
                    ...{ servicePrincipalId: this.servicePrincipalId, servicePrincipalKey: this.servicePrincipalKey, tenantId: this.tenantId }
                    }
                });
            } else if (!!addSpnToEnvironment && authorizationScheme == 'workloadidentityfederation') {
                exitCode = await tool.exec({
                    failOnStdErr: false,
                    ignoreReturnCode: true,
                    env: {
                    ...process.env,
                    ...{ servicePrincipalId: this.servicePrincipalId, idToken: this.federatedToken, tenantId: this.tenantId }
                    }
                });
            } else {
                exitCode = await tool.exec({
                    failOnStdErr: false,
                    ignoreReturnCode: true
                 });
            }

            if (failOnStdErr && aggregatedErrorLines.length > 0) {
                let error = FAIL_ON_STDERR;
                tl.error(aggregatedErrorLines.join("\n"), tl.IssueSource.CustomerScript);
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
              let message = tl.loc('ScriptFailed', toolExecutionError);

              if (typeof toolExecutionError === 'string') {
                const expiredSecretErrorCode = 'AADSTS7000222';
                let serviceEndpointSecretIsExpired = toolExecutionError.indexOf(expiredSecretErrorCode) >= 0;

                if (serviceEndpointSecretIsExpired) {
                  const organizationURL = tl.getVariable('System.CollectionUri');
                  const projectName = tl.getVariable('System.TeamProject');
                  const serviceConnectionLink = encodeURI(`${organizationURL}${projectName}/_settings/adminservices?resourceId=${connectedService}`);

                  message = tl.loc('ExpiredServicePrincipalMessageWithLink', serviceConnectionLink);
                }
              }

              tl.setResult(tl.TaskResult.Failed, message);
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

            if (process.env.AZURESUBSCRIPTION_SERVICE_CONNECTION_ID && process.env.AZURESUBSCRIPTION_SERVICE_CONNECTION_ID !== "")
            {
                process.env.AZURESUBSCRIPTION_SERVICE_CONNECTION_ID = '';
                process.env.AZURESUBSCRIPTION_CLIENT_ID = '';
                process.env.AZURESUBSCRIPTION_TENANT_ID = '';
            }
        }
    }

    private static isLoggedIn: boolean = false;
    private static cliPasswordPath: string = null;
    private static servicePrincipalId: string = null;
    private static servicePrincipalKey: string = null;
    private static federatedToken: string = null;
    private static tenantId: string = null;

    private static async loginAzureRM(connectedService: string):Promise<void> {
        var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        var subscriptionID: string = tl.getEndpointDataParameter(connectedService, "SubscriptionID", true);
        var visibleAzLogin: boolean = tl.getBoolInput("visibleAzLogin", true);        

        if (authScheme.toLowerCase() == "workloadidentityfederation") {
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            const federatedToken = await this.getIdToken(connectedService);
            tl.setSecret(federatedToken);
            const args = `login --service-principal -u "${servicePrincipalId}" --tenant "${tenantId}" --allow-no-subscriptions --federated-token "${federatedToken}"`;

            //login using OpenID Connect federation
            Utility.throwIfError(tl.execSync("az", args), tl.loc("LoginFailed"));

            this.servicePrincipalId = servicePrincipalId;
            this.federatedToken = federatedToken;
            this.tenantId = tenantId;

            process.env.AZURESUBSCRIPTION_SERVICE_CONNECTION_ID = connectedService;
            process.env.AZURESUBSCRIPTION_CLIENT_ID = servicePrincipalId;
            process.env.AZURESUBSCRIPTION_TENANT_ID = tenantId;
        }
        else if (authScheme.toLowerCase() == "serviceprincipal") {
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

            let escapedCliPassword = cliPassword.replace(/"/g, '\\"');
            tl.setSecret(escapedCliPassword.replace(/\\/g, '\"'));
            //login using svn
            if (visibleAzLogin) {
                Utility.throwIfError(tl.execSync("az", `login --service-principal -u "${servicePrincipalId}" --password="${escapedCliPassword}" --tenant "${tenantId}" --allow-no-subscriptions`), tl.loc("LoginFailed"));
            }
            else {
                Utility.throwIfError(tl.execSync("az", `login --service-principal -u "${servicePrincipalId}" --password="${escapedCliPassword}" --tenant "${tenantId}" --allow-no-subscriptions --output none`), tl.loc("LoginFailed"));
            }
        }
        else if(authScheme.toLowerCase() == "managedserviceidentity") {
            //login using msi
            if (visibleAzLogin) {
                Utility.throwIfError(tl.execSync("az", "login --identity"), tl.loc("MSILoginFailed"));
            }
            else {
                Utility.throwIfError(tl.execSync("az", "login --identity --output none"), tl.loc("MSILoginFailed"));
            }            
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
        const planId = tl.getVariable("System.PlanId");
        const projectId = tl.getVariable("System.TeamProjectId");
        const hub = tl.getVariable("System.HostType");
        const uri = tl.getVariable("System.CollectionUri");
        const token = getSystemAccessToken();

        const authHandler = getHandlerFromToken(token);
        const connection = new WebApi(uri, authHandler);
        const api: ITaskApi = await connection.getTaskApi();
        const response = await api.createOidcToken({}, projectId, hub, planId, jobId, connectedService);
        if (response == null) {
            return null;
        }

        return response.oidcToken;
    }
}

tl.setResourcePath(path.join(__dirname, "task.json"));

if (!Utility.checkIfAzurePythonSdkIsInstalled()) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("AzureSDKNotFound"));
}

azureclitask.runMain();
