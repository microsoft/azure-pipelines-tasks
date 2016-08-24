/// <reference path="../../definitions/node.d.ts" />
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");

export class azureclitask {
    public static async runMain() {

        var toolExecutionError = null;
        try {
            tl.setResourcePath(path.join( __dirname, "task.json"));

            var tool;
            if(os.type() != "Windows_NT")
            {
                tool = tl.tool(tl.which("bash", true));
            }

            var scriptLocation:string = tl.getInput("scriptLocation");
            var scriptPath:string = null;
            var cwd:string = tl.getPathInput("cwd", true, false);

            if(scriptLocation === "scriptPath") {
                scriptPath = tl.getPathInput("scriptPath", true, true);
                // if user didn"t supply a cwd (advanced), then set cwd to folder script is in.
                // All "script" tasks should do this
                if (!tl.filePathSupplied("cwd")) {
                    cwd = path.dirname(scriptPath);
                }
            }
            else {
                var script: string = tl.getInput("inlineScript", true);
                if(os.type() != "Windows_NT") {
                    scriptPath = path.join(os.tmpdir(), "azureclitaskscript.sh");
                }
                else {
                    scriptPath = path.join(os.tmpdir(), "azureclitaskscript.bat");
                }
                this.createFile(scriptPath, script);
            }

            var args = tl.getInput("args", false);

            // determines whether output to stderr will fail a task.
            // some tools write progress and other warnings to stderr.  scripts can also redirect.
            var failOnStdErr = tl.getBoolInput("failOnStandardError", false);

            tl.mkdirP(cwd);
            tl.cd(cwd);

            if(os.type() != "Windows_NT") {
                tool.arg(scriptPath);
            }
            else {
                tool = tl.tool(tl.which(scriptPath, true));
            }

            var connectedServiceNameSelector = tl.getInput("connectedServiceNameSelector", true);
            this.loginAzure(connectedServiceNameSelector);

            tool.line(args); // additional args should always call line. line() parses quoted arg strings
            await tool.exec({ failOnStdErr: failOnStdErr });
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
            if(scriptLocation === "inlineScript")
            {
                this.deleteFile(scriptPath);
            }
            //Logout of Azure if logged in
            if (this.isLoggedIn) {
                this.logoutAzure(connectedServiceNameSelector);
            }

            //set the task result to either succeeded or failed based on error was thrown or not
            if (toolExecutionError) {
                tl.setResult(tl.TaskResult.Failed, tl.loc("ScriptFailed", toolExecutionError));
            }
            else {
                tl.setResult(tl.TaskResult.Succeeded, tl.loc("ScriptReturnCode", 0));
            }
        }
    }

    private static isLoggedIn:boolean = false;

    private static loginAzure(connectedServiceNameSelector:string)
    {
        var connectedService:string;
        if(connectedServiceNameSelector === "connectedServiceNameARM")
        {
            connectedService = tl.getInput("connectedServiceNameARM", true);
            this.loginAzureRM(connectedService);
        }
        else {
            connectedService = tl.getInput("connectedServiceName", true);
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
            const publishSettingFileName:string = path.join(os.tmpdir() ,"subscriptions.publishsettings");
            this.createPublishSettingFile(subscriptionName, subscriptionId, bytes, publishSettingFileName);
            var resultOfToolExecution = tl.execSync("azure", "account import " + publishSettingFileName);
            this.deleteFile(publishSettingFileName);
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
            err.stderr = tl.loc("UnsupportedEndpointScheme");
            throw(err);
        }
    }

    private static logoutAzure(connectedServiceNameSelector:string)
    {
        try {
            var connectedService:string;
            if (connectedServiceNameSelector === "connectedServiceNameARM") {
                connectedService = tl.getInput("connectedServiceNameARM", true);
                this.logoutAzureRM(connectedService);
            }
            else {
                connectedService = tl.getInput("connectedServiceName", true);
                this.logoutAzureClassic(connectedService);
            }
        }
        catch(err){
            // task should not fail if logout doesn`t occur
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
        this.createFile(publishSettingFileName, util.format('<?xml version="1.0" encoding="utf-8"?><PublishData><PublishProfile SchemaVersion="2.0" PublishMethod="AzureServiceManagementAPI"><Subscription ServiceManagementUrl="https://management.core.windows.net" Id="%s" Name="%s" ManagementCertificate="%s" /> </PublishProfile></PublishData>',subscriptionId, subscriptionName, certificate));
    }

    private static createFile (filePath:string, data:string)
    {
        try {
            fs.writeFileSync(filePath, data);
        }
        catch(err) {
            this.deleteFile(filePath);
            throw err;
        }
    }

    private static deleteFile(filePath:string): void {
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
azureclitask.runMain();