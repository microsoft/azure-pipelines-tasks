/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import fs = require('fs');
import util = require('util');

export class azureclitask {
    public static async runMain() {

        var toolExecutionError = null;
        try {
            tl.setResourcePath(path.join( __dirname, 'task.json'));

            var bash = tl.createToolRunner(tl.which('bash', true));

            var scriptPath = tl.getPathInput('scriptPath', true, true);
            var args = tl.getInput('args', false);
            var cwd = tl.getPathInput('cwd', true, false);
            // if user didn't supply a cwd (advanced), then set cwd to folder script is in.
            // All "script" tasks should do this
            if (!tl.filePathSupplied('cwd')) {
                cwd = path.dirname(scriptPath);
            }

            // determines whether output to stderr will fail a task.
            // some tools write progress and other warnings to stderr.  scripts can also redirect.
            var failOnStdErr = tl.getBoolInput('failOnStandardError', false);

            tl.mkdirP(cwd);
            tl.cd(cwd);

            var connectedServiceNameSelector = tl.getInput('connectedServiceNameSelector', true);
            this.loginAzure(connectedServiceNameSelector);

            bash.pathArg(scriptPath);
            bash.argString(args); // additional args should always call argString.  argString() parses quoted arg strings

            await bash.exec({failOnStdErr: failOnStdErr});
        }
        catch (err) {
            if(err.stderr){
                toolExecutionError = err.stderr;
            }
            else {
                toolExecutionError = err;
            }
            //go to finally and logout of azure and set task result
        }
        finally {
            //Logout of Azure if logged in
            if (this.isLoggedIn) {
                this.logoutAzure(connectedServiceNameSelector);
            }

            //set the task result to either succeeded or failed based on error was thrown or not
            if (toolExecutionError) {
                tl.setResult(tl.TaskResult.Failed, tl.loc('ScriptFailed', toolExecutionError));
            }
            else {
                tl.setResult(tl.TaskResult.Succeeded, tl.loc('ScriptReturnCode', 0));
            }
        }
    }

    private static isLoggedIn:boolean = false;

    private static loginAzure(connectedServiceNameSelector:string)
    {
        var connectedService:string;
        if(connectedServiceNameSelector === 'ConnectedServiceNameARM')
        {
            connectedService = tl.getInput('connectedServiceNameARM', true);
            this.loginAzureRM(connectedService);
        }
        else {
            connectedService = tl.getInput('connectedServiceName', true);
            this.loginAzureClassic(connectedService);
        }
    }

    private static loginAzureRM(connectedService:string): void {
        var endpointAuth = tl.getEndpointAuthorization(connectedService, true);
        var servicePrincipalId:string = endpointAuth.parameters["serviceprincipalid"];
        var servicePrincipalKey:string = endpointAuth.parameters["serviceprincipalkey"];
        var tenantId:string = endpointAuth.parameters["tenantid"];
        var subscriptionName:string = tl.getEndpointDataParameter(connectedService, "SubscriptionName", true);
        //set the azure mode to arm to use azureRM commands
        this.throwIfError(tl.execSync("azure", "config mode arm"));
        //login using svn
        this.throwIfError(tl.execSync("azure", "login -u " + servicePrincipalId + " -p " + servicePrincipalKey + " --tenant " + tenantId + " --service-principal"));
        this.isLoggedIn = true;
        //set the subscription imported to the current subscription
        this.throwIfError(tl.execSync("azure", "account set " + subscriptionName));
    }

    private static loginAzureClassic(connectedService):void {
        var endpointAuth = tl.getEndpointAuthorization(connectedService, true);
        var subscriptionName:string = tl.getEndpointDataParameter(connectedService, "SubscriptionName", true);
        //set the azure mode to asm to use azureRM commands
        this.throwIfError(tl.execSync("azure", "config mode asm"));
        if (endpointAuth.scheme === "Certificate") {
            var bytes = endpointAuth.parameters["certificate"];
            var subscriptionId:string = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true);
            const publishSettingFileName:string = 'subscriptions.publishsettings';
            this.createPublishSettingFile(subscriptionName, subscriptionId, bytes, publishSettingFileName);
            var resultOfToolExecution = tl.execSync("azure", "account import " + publishSettingFileName);
            this.deletePublishSettingFile(publishSettingFileName);
            this.throwIfError(resultOfToolExecution);
            this.isLoggedIn = true;
            //set the subscription imported to the current subscription
            this.throwIfError( tl.execSync("azure", "account set " + subscriptionName));
        }
        else if (endpointAuth.scheme === "UsernamePassword") {
            var username:string = endpointAuth.parameters["username"];
            var passwd:string = endpointAuth.parameters["password"];
            this.throwIfError(tl.execSync("azure", "login -u " + username + " -p " + passwd));
            this.isLoggedIn = true;
            //set the subscription imported to the current subscription
            this.throwIfError(tl.execSync("azure", "account set " + subscriptionName));
        }
        else {
            var err;
            err.stderr = tl.loc('UnsupportedEndpointScheme');
            throw(err);
        }
    }

    private static logoutAzure(connectedServiceNameSelector:string)
    {
        var connectedService:string;
        if(connectedServiceNameSelector ==='ConnectedServiceNameARM')
        {
            connectedService = tl.getInput('connectedServiceNameARM', true);
            this.logoutAzureRM(connectedService);
        }
        else {
            connectedService = tl.getInput('connectedServiceName', true);
            this.logoutAzureClassic(connectedService);
        }
    }

    private static logoutAzureRM(connectedService:string)
    {
        var subscriptionName:string = tl.getEndpointDataParameter(connectedService, "SubscriptionName", true);
        tl.execSync("azure", " account clear -s " + subscriptionName);
    }

    private static logoutAzureClassic(connectedService:string)
    {
        var endpointAuth = tl.getEndpointAuthorization(connectedService, true);
        if(endpointAuth["scheme"] === "usernamePassword")
        {
            var username:string = endpointAuth.parameters["username"];
            tl.execSync("azure", "logout -u " + username);
        }
        else {
            var subscriptionName:string = tl.getEndpointDataParameter(connectedService, "SubscriptionName", true);
            tl.execSync("azure", " account clear -s " + subscriptionName);
        }
    }

    private static throwIfError(resultOfToolExecution):void {
        if (resultOfToolExecution.stderr) {
            throw resultOfToolExecution;
        }
    }

    private static createPublishSettingFile(subscriptionName:string, subscriptionId:string, certificate:string, publishSettingFileName:string): void  {
        //writing the data to the publishsetting file
        try {
            fs.writeFileSync(publishSettingFileName, util.format('<?xml version="1.0" encoding="utf-8"?><PublishData><PublishProfile SchemaVersion="2.0" PublishMethod="AzureServiceManagementAPI"><Subscription ServiceManagementUrl="https://management.core.windows.net" Id="%s" Name="%s" ManagementCertificate="%s" /> </PublishProfile></PublishData>',subscriptionId, subscriptionName, certificate));
        }
        catch (err) {
            this.deletePublishSettingFile(publishSettingFileName);
            console.error("Error in writing PublishSetting File");
            throw err;
        }
    }

    private static deletePublishSettingFile(publishSettingFileName:string): void {
        if (fs.existsSync(publishSettingFileName)) {
            try {
                //delete the publishsetting file created earlier
                fs.unlinkSync(publishSettingFileName);
            }
            catch (err) {
                console.error("Error in deleting PublishSetting File");
                throw err;
            }
        }
    }

}
azureclitask.runMain();