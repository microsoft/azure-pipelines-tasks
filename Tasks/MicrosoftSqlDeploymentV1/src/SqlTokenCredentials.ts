/**
 * Helpers for acquiring a SQL-audience access token from an Azure service connection
 * without disturbing the ARM credential the rest of the task depends on.
 *
 * Kept in its own module so the cloning behaviour can be unit tested against a real
 * ApplicationTokenCredentials instance.
 */

/**
 * Returns the SQL Database OAuth audience URL for the given Azure environment.
 * Defaults to Azure public cloud when the environment is unknown.
 */
export function getSqlAudienceFromEnvironment(environment: string): string {
    switch ((environment ?? '').toLowerCase()) {
        case 'azureusgovernment': return 'https://database.usgovcloudapi.net/';
        case 'azurechinacloud':   return 'https://database.chinacloudapi.cn/';
        case 'azuregermancloud':  return 'https://database.cloudapi.de/';
        default:                  return 'https://database.windows.net/';
    }
}

/**
 * Builds a credential that requests SQL-audience tokens without disturbing the ARM
 * credential that firewall rule management depends on.
 *
 * azureEndpoint.applicationTokenCredentials is shared: AzureSqlResourceManager passes the
 * same object to its ServiceClient, and that client outlives the deployment because the
 * firewall rule is removed in a finally block. Acquiring a SQL-scoped token through the
 * shared object makes later ARM calls reuse the wrong audience, and removeFirewallRule()
 * only warns on failure - so the temporary rule would leak while the task reported success.
 *
 * Both resource fields are set because the code paths read different ones:
 *   ADAL service principal / MSAL -> activeDirectoryResourceId
 *   ADAL managed identity         -> baseUrl (getMSIAuthorizationToken)
 *
 * All three caches are cleared:
 *   token_deferred - the ADAL memo; a non-forced getToken() returns it verbatim
 *   msalInstance   - getMSAL() reuses an existing instance rather than rebuilding, and
 *                    configureMSALWithMSI captures the resource at build time, so an
 *                    inherited ARM-built instance would keep issuing ARM tokens
 *   accessToken    - an endpoint-supplied token that getADALToken returns verbatim when
 *                    not forced, ignoring the audience entirely
 *
 * Cloning is used rather than calling the constructor because it takes 17 positional
 * parameters, several of which are TypeScript-private. Note this relies on those fields
 * being enumerable own properties at runtime - if the library moves to true private fields
 * or a WeakMap, the unit tests covering this function are what will catch it.
 */
export function createSqlScopedCredentials(azureEndpoint: any, sqlAudience: string): any {
    const armCredentials = azureEndpoint.applicationTokenCredentials;
    const sqlCredentials = Object.create(Object.getPrototypeOf(armCredentials));
    Object.assign(sqlCredentials, armCredentials);

    sqlCredentials.token_deferred = undefined;
    sqlCredentials.msalInstance = undefined;
    sqlCredentials.accessToken = undefined;
    sqlCredentials.activeDirectoryResourceId = sqlAudience;
    sqlCredentials.baseUrl = sqlAudience;

    return sqlCredentials;
}
