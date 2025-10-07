import tl = require("azure-pipelines-task-lib/task");
import { Secret } from "./models/secret";
import { ConfigurationSetting, SecretReferenceValue } from '@azure/app-configuration';
import { KeyVaultSecret, KeyVaultSecretIdentifier, SecretClient, parseKeyVaultSecretIdentifier } from '@azure/keyvault-secrets';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { ArgumentNullError, ArgumentError } from "./errors";
import { AzureEnvironments, KeyVaultHostNameSuffix } from "./constants";
import { ConnectedServiceCredential } from "./connectedServiceCredentials";

export class KeyVaultClient {

    private _endpoint: AzureEndpoint;
    private _vaultHostNameSuffix: string;

    constructor(endpoint: AzureEndpoint) {
        this._endpoint = endpoint;
        this._vaultHostNameSuffix = KeyVaultClient.getValueHostNameSuffix(this._endpoint.environment);
    }

    public async getSecret(setting: ConfigurationSetting<SecretReferenceValue>): Promise<Secret> {
        if (setting.value.secretId === null) {
            throw new ArgumentNullError(tl.loc("SecretUrlCannotBeEmpty")); 
        }
        
        if (!this.isValidUrl(setting.value.secretId)) {
            throw new ArgumentError(tl.loc("InvalidSecretUrl"));      
        }

        const parsedSecretIdentifier: KeyVaultSecretIdentifier = parseKeyVaultSecretIdentifier(
            setting.value.secretId
        );
       
        const uriScheme: string = "https://";
        const vaultAudience: string = uriScheme + this._vaultHostNameSuffix;

        const kvCredential: ConnectedServiceCredential = new ConnectedServiceCredential(this._endpoint, vaultAudience);
        const secretClient: SecretClient = new SecretClient(
            parsedSecretIdentifier.vaultUrl,
            kvCredential
        );
        
        const result: KeyVaultSecret = await secretClient.getSecret(parsedSecretIdentifier.name);
        
        return {
            value: result.value,
            id: result.properties.id
        };
    }

    private static getValueHostNameSuffix(environment: string): string {

        switch (environment) {
            case AzureEnvironments.AzureChina:
                return KeyVaultHostNameSuffix.AzureChina;

            case AzureEnvironments.AzureGovernment:
                return KeyVaultHostNameSuffix.AzureGovernment;

            default:
                return KeyVaultHostNameSuffix.AzurePublicCloud;
        }
    }

    private isValidUrl(secretUrl: string): boolean {
        const components: string[] = secretUrl.substring("https://".length).split('/');

        return components.length > 2 && components[0].toLowerCase().endsWith(this._vaultHostNameSuffix);
    }
}
