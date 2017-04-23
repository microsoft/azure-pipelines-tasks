/// <reference path="../../../definitions/node.d.ts" /> 
/// <reference path="../../../definitions/vsts-task-lib.d.ts" /> 
/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/vso-node-api.d.ts" /> 

import keyVaultTaskParameters = require("../models/KeyVaultTaskParameters");
import armKeyVault = require("./azure-rest/azure-arm-keyvault");
import util = require("util")
import tl = require("vsts-task-lib/task");

export class KeyVault {

    private taskParameters: keyVaultTaskParameters.KeyVaultTaskParameters;
    private keyVaultClient: armKeyVault.KeyVaultClient;

    constructor(taskParameters: keyVaultTaskParameters.KeyVaultTaskParameters) {
        this.taskParameters = taskParameters;
        this.keyVaultClient = new armKeyVault.KeyVaultClient(
            this.taskParameters.vaultCredentials, 
            this.taskParameters.subscriptionId,
            this.taskParameters.keyVaultName,
            this.taskParameters.keyVaultUrl);
    }

    public downloadSecrets(): Promise<void> {

        var downloadAllSecrets = false;
        if (this.taskParameters.secretsFilter && this.taskParameters.secretsFilter.length > 0)
        {
            if (this.taskParameters.secretsFilter.length === 1 && this.taskParameters.secretsFilter[0] === "*") {
                downloadAllSecrets = true;
            }
        } else {
            downloadAllSecrets = true;
        }

        if (downloadAllSecrets) {
            return this.downloadAllSecrets();
        } else {
            return this.downloadSelectedSecrets(this.taskParameters.secretsFilter);
        }
    }

    private downloadAllSecrets(): Promise<void> {
        tl.debug(util.format("Downloading all secrets from vault: %s", this.taskParameters.keyVaultName));

        return new Promise<void>((resolve, reject) => {
            this.keyVaultClient.getSecrets("", (error, listOfSecrets, request, response) => {
                if (error) {
                    return reject(tl.loc("GetSecretsFailed", this.getError(error)));
                }

                if (listOfSecrets.length == 0) {
                    console.log(tl.loc("NoSecretsFound", this.taskParameters.keyVaultName));
                    return resolve();
                }

                console.log(tl.loc("NumberOfSecretsFound", this.taskParameters.keyVaultName, listOfSecrets.length));
                listOfSecrets = this.filterDisabledAndExpiredSecrets(listOfSecrets);
                console.log(tl.loc("NumberOfEnabledSecretsFound", this.taskParameters.keyVaultName, listOfSecrets.length));

                var getSecretValuePromises: Promise<any>[] = [];
                listOfSecrets.forEach((secret: armKeyVault.AzureKeyVaultSecret, index: number) => {
                    getSecretValuePromises.push(this.downloadSecretValue(secret.name));
                });

                Promise.all(getSecretValuePromises).then(() =>{
                    return resolve();
                }).catch((error) => {
                    return reject(error);
                });
            });
        });
    }

    private downloadSelectedSecrets(selectedSecrets: string[]): Promise<void> {
        tl.debug(util.format("Downloading selected secrets from vault: %s", this.taskParameters.keyVaultName));

        return new Promise<void>((resolve, reject) => {
            var getSecretValuePromises: Promise<any>[] = [];
            selectedSecrets.forEach((secretName: string, index: number) => {
                getSecretValuePromises.push(this.downloadSecretValue(secretName));
            });

            Promise.all(getSecretValuePromises).then(() =>{
                return resolve();
            }).catch((error) => {
                return reject(error);
            });
        });
    }

    private filterDisabledAndExpiredSecrets(listOfSecrets: armKeyVault.AzureKeyVaultSecret[]): armKeyVault.AzureKeyVaultSecret[] {
        var result: armKeyVault.AzureKeyVaultSecret[] = [];
        var now: Date = new Date();

        listOfSecrets.forEach((value: armKeyVault.AzureKeyVaultSecret, index: number) => {
            if (value.enabled && (!value.expires || value.expires > now)) {
                result.push(value);
            }
        });
        
        return result;
    }

    private downloadSecretValue(secretName: string): Promise<any> {
        tl.debug(util.format("Downloading secret value for: %s", secretName));

        return new Promise<void>((resolve, reject) => {
            // if (tl.getVariable(secretName) !== undefined) {
            //     return reject(tl.loc("ConflictingVariableFound", secretName));
            // }

            this.keyVaultClient.getSecretValue(secretName, (error, secretValue, request, response) => {
                if (error) {
                    return reject(tl.loc("GetSecretValueFailed", secretName, this.getError(error)));
                }
                
                console.log("##vso[task.setvariable variable=" + secretName + ";issecret=true;]" + secretValue);
                return resolve();
            });
        });
    }

    private getError(error: any) {
        tl.debug(JSON.stringify(error));
        if (error && error.message) {
            return error.message;
        }

        return error;
    }
}