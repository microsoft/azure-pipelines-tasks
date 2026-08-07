import tl = require('azure-pipelines-task-lib/task');
import { ServiceClient } from 'azure-pipelines-tasks-azure-arm-rest/AzureServiceClient';
import { ToError } from 'azure-pipelines-tasks-azure-arm-rest/AzureServiceClientBase';
import { WebRequest, WebResponse } from 'azure-pipelines-tasks-azure-arm-rest/webClient';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';

// API docs: https://docs.microsoft.com/rest/api/sql
const SqlApiVersion = '2021-11-01';

export interface AzureSqlServer {
    id: string;
    name: string;
    location: string;
    properties: {
        fullyQualifiedDomainName: string;
        state: string;
        version: string;
    }
}

export interface FirewallRule {
    id: string;
    name: string;
    type: string;
    properties: {
        startIpAddress: string;
        endIpAddress: string;
    }
}

export default class AzureSqlResourceManager {
    private _client: ServiceClient;
    private _sqlServer?: AzureSqlServer;

    private constructor(azureEndpoint: AzureEndpoint) {
        this._client = new ServiceClient(
            azureEndpoint.applicationTokenCredentials,
            azureEndpoint.subscriptionID,
            30 // timeout in seconds
        );
    }

    /**
     * Factory method to create AzureSqlResourceManager with populated SQL server data
     * @param serverName SQL server name (e.g., "myserver" or "myserver.database.windows.net")
     * @param azureEndpoint Azure endpoint with credentials
     */
    public static async getResourceManager(serverName: string, azureEndpoint: AzureEndpoint): Promise<AzureSqlResourceManager> {
        const resourceManager = new AzureSqlResourceManager(azureEndpoint);
        await resourceManager._populateSqlServerData(serverName);
        return resourceManager;
    }

    /**
     * Gets the SQL server details
     */
    public getSqlServer(): AzureSqlServer | undefined {
        return this._sqlServer;
    }

    /**
     * Adds a firewall rule to the SQL server
     * @param startIpAddress Start IP address for the rule
     * @param endIpAddress End IP address for the rule
     * @returns The created firewall rule
     */
    public async addFirewallRule(startIpAddress: string, endIpAddress: string): Promise<FirewallRule> {
        if (!this._sqlServer) {
            throw new Error(tl.loc('SQLServerNotFound'));
        }

        const today = new Date();
        const firewallRuleName = `ClientIPAddress_${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}_${startIpAddress.replace(/\./g, '_')}`;

        tl.debug(`Creating firewall rule: ${firewallRuleName}`);

        // https://docs.microsoft.com/rest/api/sql/2021-11-01/firewall-rules/create-or-update
        const httpRequest = new WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this._client.getRequestUri(
            `/${this._sqlServer.id}/firewallRules/${firewallRuleName}`,
            {},
            [],
            SqlApiVersion
        );
        httpRequest.body = JSON.stringify({
            properties: {
                startIpAddress: startIpAddress,
                endIpAddress: endIpAddress
            }
        });

        try {
            const httpResponse: WebResponse = await this._client.beginRequest(httpRequest);

            if (httpResponse.statusCode !== 200 && httpResponse.statusCode !== 201) {
                throw ToError(httpResponse);
            }

            return httpResponse.body as FirewallRule;
        } catch (error) {
            throw new Error(tl.loc('FailedToAddFirewallRule', error.message || error));
        }
    }

    /**
     * Removes a firewall rule from the SQL server
     * @param firewallRule The firewall rule to remove
     */
    public async removeFirewallRule(firewallRule: FirewallRule): Promise<void> {
        if (!this._sqlServer) {
            throw new Error(tl.loc('SQLServerNotFound'));
        }

        tl.debug(`Removing firewall rule: ${firewallRule.name}`);

        // https://docs.microsoft.com/rest/api/sql/2021-11-01/firewall-rules/delete
        const httpRequest = new WebRequest();
        httpRequest.method = 'DELETE';
        httpRequest.uri = this._client.getRequestUri(
            `/${this._sqlServer.id}/firewallRules/${firewallRule.name}`,
            {},
            [],
            SqlApiVersion
        );

        try {
            const httpResponse: WebResponse = await this._client.beginRequest(httpRequest);

            if (httpResponse.statusCode !== 200 && httpResponse.statusCode !== 204) {
                throw ToError(httpResponse);
            }
        } catch (error) {
            throw new Error(tl.loc('FailedToRemoveFirewallRule', firewallRule.name, error.message || error));
        }
    }

    /**
     * Populates SQL server data by listing all SQL servers and finding the matching one
     * @param serverName SQL server name
     */
    private async _populateSqlServerData(serverName: string): Promise<void> {
        // Remove .database.windows.net suffix if present
        const sqlServerHostnameSuffix = '.database.windows.net';
        if (serverName.toLowerCase().endsWith(sqlServerHostnameSuffix)) {
            serverName = serverName.substring(0, serverName.length - sqlServerHostnameSuffix.length);
        }

        // Also handle tcp: prefix and port numbers
        serverName = serverName.replace(/^tcp:/i, '').split(',')[0].trim();

        tl.debug(`Looking for SQL server: ${serverName}`);

        // https://docs.microsoft.com/rest/api/sql/2021-11-01/servers/list
        const httpRequest = new WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(
            '//subscriptions/{subscriptionId}/providers/Microsoft.Sql/servers',
            {},
            [],
            SqlApiVersion
        );

        try {
            const httpResponse: WebResponse = await this._client.beginRequest(httpRequest);

            if (httpResponse.statusCode !== 200) {
                throw ToError(httpResponse);
            }

            const sqlServers = httpResponse.body?.value as AzureSqlServer[];

            if (!sqlServers || sqlServers.length === 0) {
                throw new Error(tl.loc('NoSQLServersFound', this._client.subscriptionId));
            }

            // Find server by name (case-insensitive)
            this._sqlServer = sqlServers.find(
                server => server.name.toLowerCase() === serverName.toLowerCase()
            );

            if (!this._sqlServer) {
                throw new Error(tl.loc('SQLServerNotFoundInSubscription', serverName, this._client.subscriptionId));
            }

            tl.debug(`Found SQL server: ${this._sqlServer.name} (${this._sqlServer.id})`);
        } catch (error) {
            throw new Error(tl.loc('FailedToGetSQLServerDetails', serverName, error.message || error));
        }
    }
}
