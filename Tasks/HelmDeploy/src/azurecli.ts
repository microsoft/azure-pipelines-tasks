import path = require("path");
import tl = require("vsts-task-lib/task");
import fs = require("fs");
import util = require("util");
import os = require("os");
import * as tr from "vsts-task-lib/toolrunner";
import basecommand from "./basecommand"
import * as helmutil from "./utils"

export default class azurecli extends basecommand {

    private connectedServiceEndpoint: string;
    public getTool(): string {
        return "az";
    }

    constructor(armEndpoint: string){
        super();
        this.connectedServiceEndpoint = armEndpoint;
    }

    public login(): void {
        
        // azure login
        var command = this.createCommand();
        command.line("login --service-principal -u \""+ azurecli.getServicePrincipalId(this.connectedServiceEndpoint) +"\" -p \""+ azurecli.getServicePrincipalKey(this.connectedServiceEndpoint)
        +"\" --tenant \""+ azurecli.getTenantId(this.connectedServiceEndpoint)+"\"");
        this.execCommandSync(command);
        
        //azure set subscription
        var setSubscription = this.createCommand();
        setSubscription.line("account set --subscription \"" + azurecli.getSubscriptionName(this.connectedServiceEndpoint) + "\"");
        this.execCommandSync(setSubscription);
    }

    public logout(): void {
        var command = this.createCommand();
        command.arg("account");
        command.arg("clear");
        this.execCommandSync(command);
    }

    public getCredential(resourceGroup: string, clusterName: string): string {
        var kubeconfig = azurecli.getKubeConfigFilePath();

        var command = this.createCommand();
        command.line("aks get-credentials")
        command.arg("--name");
        command.arg(clusterName);
        //TODO: test spaces in file path
        command.arg("--resource-group");
        command.arg(resourceGroup);
        
        command.arg("--file");
        command.arg(kubeconfig);

       //var executionOption: tr.IExecOptions ;
        //executionOption.failOnStdErr = true;
        this.execCommandSync(command);

        tl.debug("Downloaded kubeconfig file at "+ kubeconfig);
        return kubeconfig;
    }

    public getResourceGroup(clusterName: string): string {
        
        var query = "\"[?name=='"+clusterName+"'].id\"";
        var command = this.createCommand();
        command.line("aks list")
        command.arg("--query");
        command.line(query)

        var execResult = command.execSync();
        basecommand.handleExecResult(execResult);
        return azurecli.extractResourceGroup(JSON.parse(execResult.stdout)[0]);
    }

    private static getServicePrincipalId(connectedServiceEndpoint: string): string {
        return tl.getEndpointAuthorizationParameter(connectedServiceEndpoint, "serviceprincipalid", false);
    }

    private static getServicePrincipalKey(connectedServiceEndpoint: string): string {
        return tl.getEndpointAuthorizationParameter(connectedServiceEndpoint, "servicePrincipalKey", false);
    }

    private static getTenantId(connectedServiceEndpoint: string): string {
        return tl.getEndpointAuthorizationParameter(connectedServiceEndpoint, "tenantId", false);
    }

    private static getSubscriptionName(connectedServiceEndpoint: string): string {
        return tl.getEndpointDataParameter(connectedServiceEndpoint, "SubscriptionName", true);
    }

    private static getKubeConfigFilePath(): string {
        var userdir = helmutil.getNewUserDirPath();
        return path.join(userdir, "config");
    }

    private static extractResourceGroup(id: string) {
        var array = id.split('/');
        return array[array.findIndex(str=> str.toUpperCase() === "resourceGroups".toUpperCase()) + 1];
    }
}