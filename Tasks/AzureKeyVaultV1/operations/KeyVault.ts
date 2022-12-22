import keyVaultTaskParameters = require("../models/KeyVaultTaskParameters");
import armKeyVault = require("./azure-arm-keyvault");
import util = require("util");
import tl = require("azure-pipelines-task-lib/task");

import * as path from 'path';
import * as fs from 'fs';

export class SecretsToErrorsMapping { 
    public errorsMap: { [key: string]: string; };

    constructor() {
        this.errorsMap = {};
    }

    public addError(secretName: string, errorMessage: string): void {
        this.errorsMap[secretName] = errorMessage;
    }

    public isEmpty(): boolean {
        for (var key in this.errorsMap) {
            return false;
        }

        return true;
    }

    public getAllErrors(): string {
        var allErrors = "";
        for (var key in this.errorsMap) {
            if (this.errorsMap.hasOwnProperty(key)) {
                var errorMessagePerSecret = key + ": " + JSON.stringify(this.errorsMap[key]);
                allErrors = allErrors + "\n" + errorMessagePerSecret;
            }
        }

        return allErrors;
    }
}

export class KeyVault {

    private taskParameters: keyVaultTaskParameters.KeyVaultTaskParameters;
    private keyVaultClient: armKeyVault.KeyVaultClient;
    private provisionKeyVaultSecretsScript: string;

    constructor(taskParameters: keyVaultTaskParameters.KeyVaultTaskParameters) {
        this.taskParameters = taskParameters;

        this.keyVaultClient = new armKeyVault.KeyVaultClient(
            this.taskParameters.vaultCredentials, 
            this.taskParameters.subscriptionId,
            this.taskParameters.keyVaultName,
            this.taskParameters.keyVaultUrl);

        let scriptContentFormat;
        if(this.taskParameters.scheme === "ManagedServiceIdentity") {
            scriptContentFormat = `$ErrorActionPreference=\"Stop\";
            Login-AzureRmAccount -SubscriptionId %s;
            $vmMetadata = Invoke-RestMethod -Headers @{"Metadata"="true"} -URI http://169.254.169.254/metadata/instance?api-version=2017-08-01 -Method get
            $vm = Get-AzureRmVM -ResourceGroupName $vmMetadata.compute.resourceGroupName  -Name  $vmMetadata.compute.name
            $spn=(Get-AzureRmADServicePrincipal -SPN %s);
            Set-AzureRmKeyVaultAccessPolicy -VaultName %s -ObjectId $vm.Identity.PrincipalId -PermissionsToSecrets get,list;`;
        } else {
            scriptContentFormat = `$ErrorActionPreference=\"Stop\";
            Login-AzureRmAccount -SubscriptionId %s;
            $spn=(Get-AzureRmADServicePrincipal -SPN %s);
            $spnObjectId=$spn.Id;
            Set-AzureRmKeyVaultAccessPolicy -VaultName %s -ObjectId $spnObjectId -PermissionsToSecrets get,list;`;
        }

        this.provisionKeyVaultSecretsScript = util.format(scriptContentFormat, this.taskParameters.subscriptionId, this.taskParameters.servicePrincipalId, this.taskParameters.keyVaultName);
    }

    public async downloadSecrets(secretsToErrorsMap: SecretsToErrorsMapping): Promise<void> {

        var downloadAllSecrets = false;
        if (this.taskParameters.secretsFilter && this.taskParameters.secretsFilter.length > 0)
        {
            if (this.taskParameters.secretsFilter.length === 1 && this.taskParameters.secretsFilter[0] === "*") {
                downloadAllSecrets = true;
            }
        } else {
            downloadAllSecrets = true;
        }

        console.log(tl.loc("SubscriptionIdLabel", this.taskParameters.subscriptionId));
        console.log(tl.loc("KeyVaultNameLabel", this.taskParameters.keyVaultName));

        // Key vault task explicitly handles multi line masking - hence setting SYSTEM_UNSAFEALLOWMULTILINESECRET to true
        tl.setVariable("SYSTEM_UNSAFEALLOWMULTILINESECRET", "true");

        if (downloadAllSecrets)
        {
            return await this.downloadAllSecrets(secretsToErrorsMap);
        }
        else
        {
            return await this.downloadSelectedSecrets(this.taskParameters.secretsFilter, secretsToErrorsMap);
        }
    }

    private downloadAllSecrets(secretsToErrorsMap: SecretsToErrorsMapping): Promise<void> {
        tl.debug(util.format("Downloading all secrets from subscriptionId: %s, vault: %s", this.taskParameters.subscriptionId, this.taskParameters.keyVaultName));

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
                const secrets = this.filterDisabledAndExpiredSecrets(listOfSecrets).map(secret => secret.name);
                console.log(tl.loc("NumberOfEnabledSecretsFound", this.taskParameters.keyVaultName, secrets.length));
                
                this.downloadSelectedSecrets(secrets, secretsToErrorsMap).then(() => {
                    return resolve();
                });
            });
        });
    }

    private async downloadSelectedSecrets(secrets: string[], secretsToErrorsMap: SecretsToErrorsMapping) : Promise<void>
    {
        tl.debug(util.format("Downloading selected secrets from subscriptionId: %s, vault: %s", this.taskParameters.subscriptionId, this.taskParameters.keyVaultName));

        const chunkSize = 20;
        for(let i = 0; i < secrets.length; i += chunkSize)
        {         
            const start = new Date().getTime();   
            
            tl.debug(`Downloading part [${i} - ${Math.min(secrets.length, i + chunkSize)}] (total ${secrets.length} secrets)`);
            const secretPromises: Promise<void>[] = [];
            for(let j = i; j < secrets.length && j < i + chunkSize; j++)
            {
                secretPromises.push(this.downloadSecretValue(secrets[j], secretsToErrorsMap));
            }
            
            await Promise.all(secretPromises);
            const end = new Date().getTime();
            tl.debug(`Downloaded part [${i} - ${i + secretPromises.length}] (took ${end - start} ms) (total ${secrets.length} secrets)`);
        }
    }

    private filterDisabledAndExpiredSecrets(listOfSecrets: armKeyVault.AzureKeyVaultSecret[]): armKeyVault.AzureKeyVaultSecret[]
    {
        const now: Date = new Date();
        const result = listOfSecrets.filter((value, _) => value.enabled && (!value.expires || value.expires > now));        
        return result;
    }

    private downloadSecretValue(secretName: string, secretsToErrorsMap: SecretsToErrorsMapping): Promise<void> {
        tl.debug(util.format("Promise for downloading secret value for: %s", secretName));
        secretName = secretName.trim();

        return new Promise<void>((resolve, reject) => {
            this.keyVaultClient.getSecretValue(secretName, (error, secretValue, request, response) => {
                if (error) {
                    let errorMessage = this.getError(error);
                    secretsToErrorsMap.addError(secretName, errorMessage);
                }
                else {
                    this.setVaultVariable(secretName, secretValue);
                }
                
                return resolve();
            });
        });
    }

    private tryFlattenJson(jsonString: string): string {
        try {
            var o = JSON.parse(jsonString);

            if (o && typeof o === "object") {
                return JSON.stringify(o);
            }
        }
        catch (e) { }

        return null;
    }

    private setVaultVariable(secretName: string, secretValue: string): void {
        if (!secretValue) {
            return;
        }

        // Support multiple stages using different key vaults with the same secret name but with different version identifiers
        let secretNameWithoutVersion = secretName.split("/")[0];

        let doNotMaskMultilineSecrets = tl.getVariable("SYSTEM_DONOTMASKMULTILINESECRETS");
        if (doNotMaskMultilineSecrets && doNotMaskMultilineSecrets.toUpperCase() === "TRUE") {
            tl.setVariable(secretNameWithoutVersion, secretValue, true);
            tl.setVariable(secretName, secretValue, true);
            return;
        }

        if (secretValue.indexOf('\n') < 0) {
            // single-line case
            tl.setVariable(secretNameWithoutVersion, secretValue, true);
            tl.setVariable(secretName, secretValue, true);
        }
        else {
            // multi-line case
            let strVal = this.tryFlattenJson(secretValue);
            if (strVal) {
                console.log(util.format("Value of secret %s has been converted to single line.", secretName));
                tl.setVariable(secretNameWithoutVersion, strVal, true);
                tl.setVariable(secretName, strVal, true);
            }
            else {
                let lines = secretValue.split('\n');
                lines.forEach((line: string, index: number) => {
                    this.trySetSecret(secretName, line);
                });
                tl.setVariable(secretNameWithoutVersion, secretValue, true);
                tl.setVariable(secretName, secretValue, true);
            }
        }
    }

    private trySetSecret(secretName: string, secretValue: string): void {
        try {
            let regExp = new RegExp(secretValue);

            console.log("##vso[task.setsecret]" + secretValue);
        }
        catch (e) {
            console.log(tl.loc("CouldNotMaskSecret", secretName));
        }
    }

    private getError(error: any): any {
        tl.debug(JSON.stringify(error));

        if (error && error.message && error.statusCode && error.statusCode == 403) {
            this.generateAndUploadProvisionKeyVaultPermissionsScript();
            return tl.loc("AccessDeniedError", error.message);
        }

        if (error && error.message) {
            return error.message;
        }

        return error;
    }

    private generateAndUploadProvisionKeyVaultPermissionsScript(): void {
        let tempPath = tl.getVariable('Agent.BuildDirectory') || tl.getVariable('Agent.ReleaseDirectory') || process.cwd();
        let filePath = path.join(tempPath, "ProvisionKeyVaultPermissions.ps1");

        fs.writeFile(filePath, this.provisionKeyVaultSecretsScript, (err) => {
            if (err) {
                console.log(tl.loc("CouldNotWriteToFile", err));
                return;
            }
            else {
                console.log(tl.loc("UploadingAttachment", filePath));
                console.log(`##vso[task.uploadfile]${filePath}`);
            }
        });
    }
}