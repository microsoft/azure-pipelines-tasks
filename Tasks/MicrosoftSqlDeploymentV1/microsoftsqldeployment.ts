import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');
import SqlPackageHelper from './src/SqlPackageHelper';
import SqlcmdHelper from './src/SqlcmdHelper';
import SqlConnectionConfig from './src/SqlConnectionConfig';
import SqlUtils from './src/SqlUtils';
import FirewallManager from './src/FirewallManager';
import AzureSqlResourceManager from './src/AzureSqlResourceManager';
import SqlProjectBuilder from './src/SqlProjectBuilder';
import { SqlPackageExecutor } from './src/SqlPackageExecutor';
import { SqlcmdExecutor, SqlcmdCredentials } from './src/SqlcmdExecutor';
import { getSqlAudienceFromEnvironment, createSqlScopedCredentials } from './src/SqlTokenCredentials';

// Node version handling for DNS and network settings
const nodeVersion = parseInt(process.version.split('.')[0].replace('v', ''));
if (nodeVersion > 16) {
    require("dns").setDefaultResultOrder("ipv4first");
    tl.debug("Set default DNS lookup order to ipv4 first");
}

if (nodeVersion > 19) {
    require("net").setDefaultAutoSelectFamily(false);
    tl.debug("Set default auto select family to false");
}

async function main(): Promise<void> {
    try {
        // Set resource path for localization
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        console.log(tl.loc('StartingDeployment'));

        // Get required inputs per specification
        const action = tl.getInput('action', true)!.trim();
        // YAML is not constrained to the pickList casing, so normalize once and use the
        // normalized value for validation, tool discovery, execution and telemetry.
        const normalizedAction = action.toLowerCase();
        const filePath = tl.getInput('path', true)!;
        const connectionString = tl.getInput('connectionString', true)!;
        
        // Mask connection string (contains sensitive data)
        tl.setSecret(connectionString);
        console.log(tl.loc('ConnectionStringProvided'));

        // Get optional inputs
        const azureSubscription = tl.getInput('azureSubscription', false);
        const publishProfile = getOptionalFilePathInput('publishProfile');
        const additionalArguments = tl.getInput('additionalArguments', false);
        const buildArguments = tl.getInput('buildArguments', false);
        const sqlpackagePath = getOptionalFilePathInput('sqlpackagePath');
        const sqlcmdPath = getOptionalFilePathInput('sqlcmdPath');
        const firewallRuleManagementInput = tl.getInput('firewallRuleManagement', false);
        
        // Determine firewall rule management default per spec
        let firewallRuleManagement: boolean;
        if (firewallRuleManagementInput === null || firewallRuleManagementInput === undefined || firewallRuleManagementInput === '') {
            // Default: true when azureSubscription is set, false otherwise
            firewallRuleManagement = !!azureSubscription;
            tl.debug(`firewallRuleManagement defaulted to: ${firewallRuleManagement}`);
        } else {
            firewallRuleManagement = firewallRuleManagementInput.toLowerCase() === 'true';
            tl.debug(`firewallRuleManagement explicitly set to: ${firewallRuleManagement}`);
        }

        if (azureSubscription) {
            console.log(tl.loc('UsingAzureSubscription', azureSubscription));
        }

        if (firewallRuleManagement && !azureSubscription) {
            throw new Error(tl.loc('FirewallManagementRequiresAzureSubscription'));
        }

        // Detect file type from extension
        const fileExtension = path.extname(filePath).toLowerCase();
        let fileType: string;
        if (fileExtension === '.dacpac') {
            fileType = 'DACPAC';
        } else if (fileExtension === '.sqlproj') {
            fileType = 'SQLPROJ';
        } else if (fileExtension === '.sql') {
            fileType = 'SQL';
        } else {
            throw new Error(tl.loc('InvalidFileExtension', fileExtension));
        }

        // Validate file exists
        tl.checkPath(filePath, 'path');

        // Validate the action/file-type combination before any tool discovery so invalid
        // inputs fail deterministically instead of triggering download/install work first.
        const sqlPackageActions = ['publish', 'script', 'deployreport'];
        if (fileType === 'SQL') {
            if (normalizedAction !== 'sqlscript') {
                throw new Error(tl.loc('InvalidAction', action));
            }
        } else if (!sqlPackageActions.includes(normalizedAction)) {
            throw new Error(tl.loc('InvalidAction', action));
        }

        console.log(tl.loc('ActionDetected', action, fileType));

        // Parse and validate connection string
        console.log(tl.loc('ParsingConnectionString'));
        const connectionConfig = new SqlConnectionConfig(connectionString);
        tl.debug(`Parsed connection string - Server: ${connectionConfig.Server}, Database: ${connectionConfig.Database}`);

        // Discover SqlPackage for DACPAC/SQLPROJ actions
        let sqlPackageExePath: string | undefined;
        const needsSqlPackage = fileType === 'DACPAC' || fileType === 'SQLPROJ';
        
        if (needsSqlPackage) {
            tl.debug(tl.loc('DetectingSqlPackage'));
            sqlPackageExePath = await SqlPackageHelper.findSqlPackage(sqlpackagePath);
            tl.debug(tl.loc('SqlPackageFound', sqlPackageExePath));
        }

        // Discover sqlcmd for SQL script actions or firewall connectivity testing
        let sqlcmdExePath: string | undefined;
        const needsSqlcmd = normalizedAction === 'sqlscript' || firewallRuleManagement;
        
        if (needsSqlcmd) {
            tl.debug(tl.loc('SettingUpSqlCmd'));
            sqlcmdExePath = await SqlcmdHelper.findSqlcmd(sqlcmdPath);
            tl.debug(tl.loc('SqlCmdFound', sqlcmdExePath));
        }

        // Firewall rule management and deployment execution
        let firewallManager: FirewallManager | undefined;
        let accessToken: string | undefined;
        let azureEndpoint: any | undefined;
        let sqlcmdCredentials: SqlcmdCredentials | undefined;
        let deployFilePath = filePath;
        let deployFileType = fileType;

        try {
            // Step 1: Azure subscription — resolve sqlcmd identity, firewall, access token
            if (azureSubscription) {
                const { AzureRMEndpoint } = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint');
                azureEndpoint = await new AzureRMEndpoint(azureSubscription).getEndpoint();

                // Resolved before firewall management so the connectivity probe authenticates
                // as the service connection, not the agent's ambient identity. Reads endpoint
                // fields only — no token acquisition, so it cannot poison the ARM token cache.
                sqlcmdCredentials = resolveSqlcmdCredentials(connectionConfig, azureSubscription, azureEndpoint);

                // Firewall management runs before the SQL token is acquired so the ARM
                // credential is still pristine here. The SQL token is additionally taken
                // from an isolated credential (createSqlScopedCredentials), which is what
                // keeps the ARM credential clean for the rule cleanup in the finally block.
                if (firewallRuleManagement) {
                    const ipAddress = await SqlUtils.detectIPAddress(connectionConfig, sqlcmdExePath!, sqlcmdCredentials);
                    if (ipAddress) {
                        const resourceManager = await AzureSqlResourceManager.getResourceManager(connectionConfig.Server, azureEndpoint);
                        firewallManager = new FirewallManager(resourceManager);
                        await firewallManager.addFirewallRule(ipAddress);
                    }
                }

                // Acquire the SQL-scoped token only for auth types that consume it
                // (ActiveDirectoryDefault/Integrated). Gating on the same condition
                // SqlPackageExecutor uses avoids pointless token requests for SQL auth,
                // AAD Password and AAD Service Principal, which carry their own credentials.
                const tokenBasedAuthTypes = ['activedirectorydefault', 'activedirectoryintegrated'];
                const authType = (connectionConfig.FormattedAuthentication ?? '').toLowerCase();
                const shouldAcquireToken = tokenBasedAuthTypes.includes(authType) &&
                    (azureEndpoint.scheme === 'ServicePrincipal' ||
                     azureEndpoint.scheme === 'WorkloadIdentityFederation' ||
                     azureEndpoint.scheme === 'ManagedServiceIdentity');

                if (shouldAcquireToken) {
                    try {
                        // Derive the audience from the service connection environment so
                        // sovereign clouds (US Gov, China, Germany) resolve correctly.
                        const sqlAudience = getSqlAudienceFromEnvironment(azureEndpoint.environment);
                        const sqlCredentials = createSqlScopedCredentials(azureEndpoint, sqlAudience);
                        accessToken = await sqlCredentials.getToken();
                        if (accessToken) {
                            tl.setSecret(accessToken);
                            tl.debug(tl.loc('AccessTokenAcquired'));
                        }
                    } catch (tokenError) {
                        tl.debug(`Access token acquisition failed (non-fatal): ${tokenError.message || tokenError}`);
                    }
                }
            } else if (!firewallRuleManagement) {
                tl.debug(tl.loc('FirewallManagementDisabled'));
            }

            // Step 2: Build .sqlproj → .dacpac, then execute SqlPackage.
            if (deployFileType === 'SQLPROJ') {
                deployFilePath = await SqlProjectBuilder.buildProject(deployFilePath, buildArguments || undefined);
                deployFileType = 'DACPAC';
                tl.debug(`SQL project built. Deploying dacpac: ${deployFilePath}`);
            }

            if (deployFileType === 'DACPAC') {
                if (!sqlPackageExePath) {
                    throw new Error(tl.loc('SqlPackageNotFound'));
                }
                tl.debug(tl.loc('ExecutingSqlPackage', normalizedAction));
                const outputFilePath = await SqlPackageExecutor.executeSqlPackage(
                    sqlPackageExePath,
                    normalizedAction,
                    deployFilePath,
                    connectionConfig,
                    publishProfile || undefined,
                    additionalArguments || undefined,
                    accessToken
                );
                if (outputFilePath && ['script', 'deployreport'].includes(normalizedAction)) {
                    tl.debug(tl.loc('OutputFileGenerated', outputFilePath));
                    tl.setVariable('SqlDeploymentOutputFile', outputFilePath);
                }
            } else if (deployFileType === 'SQL') {
                if (!sqlcmdExePath) {
                    // Should not reach here — SqlcmdHelper.findSqlcmd throws if not found
                    throw new Error(tl.loc('SqlcmdAutoInstallFailed', 'sqlcmd path is undefined'));
                }

                // For SP auth, go-mssqldb needs the tenant ID either in the User ID field
                // (as clientId@tenantId) or via the service connection. Without either, auth
                // fails with a cryptic error, so surface a clear one up front.
                const sqlAuthType = (connectionConfig.FormattedAuthentication ?? '').toLowerCase();
                if (sqlAuthType === 'activedirectoryserviceprincipal'
                    && !azureSubscription
                    && connectionConfig.UserId && !connectionConfig.UserId.includes('@')) {
                    throw new Error(tl.loc('SpAuthRequiresTenantId'));
                }

                tl.debug(tl.loc('ExecutingSqlScript', deployFilePath));

                await SqlcmdExecutor.executeSqlcmd(
                    sqlcmdExePath,
                    deployFilePath,
                    connectionConfig,
                    additionalArguments || undefined,
                    sqlcmdCredentials
                );
            }

            console.log(tl.loc('DeploymentSuccessful'));
        } finally {
            if (firewallManager) {
                await firewallManager.removeFirewallRule();
            }
            // Emit telemetry — actionable fields only, no PII. Always emitted regardless of outcome.
            try {
                const telemetry = {
                    action: normalizedAction,
                    fileType: fileType,
                    authMethod: connectionConfig.FormattedAuthentication ?? 'sqlauthentication',
                    hasAzureSubscription: !!azureSubscription,
                    sqlPackageDiscoveryMethod: needsSqlPackage ? (sqlpackagePath ? 'userSpecified' : 'discovered') : undefined,
                    sqlcmdDiscoveryMethod: needsSqlcmd ? (sqlcmdPath ? 'userSpecified' : 'discovered') : undefined,
                    sqlcmdCredentialSource: needsSqlcmd
                        ? (sqlcmdCredentials?.source ?? 'default')
                        : undefined
                };
                console.log('##vso[telemetry.publish area=TaskHub;feature=MicrosoftSqlDeploymentV1]'
                    + JSON.stringify(telemetry));
            } catch (_) { /* telemetry is non-fatal */ }
        }
    }
    catch (error) {
        tl.debug(`Deployment failed with error: ${error}`);
        tl.setResult(tl.TaskResult.Failed, tl.loc('DeploymentFailed', error.message || error));
    }
}

/**
 * Read an optional filePath input, returning undefined when the user left it blank.
 *
 * The agent roots filePath inputs before the task sees them, so an unset one arrives
 * as System.DefaultWorkingDirectory rather than an empty string. Passing that through
 * makes the task treat the repo root as a user-supplied executable or profile: for
 * sqlcmdPath and sqlpackagePath the existsSync check then succeeds (it is a real
 * directory) and execution fails with "Unable to locate executable file".
 *
 * A directory is never a valid value for any of these inputs, so treating one as
 * "not specified" also falls back to discovery rather than failing when a user
 * points at a folder by mistake.
 */
function getOptionalFilePathInput(name: string): string | undefined {
    const raw = tl.getInput(name, false);
    if (!raw || !raw.trim()) {
        return undefined;
    }

    const value = raw.trim();
    try {
        if (fs.existsSync(value) && fs.statSync(value).isDirectory()) {
            tl.debug(`Ignoring ${name}: resolved to a directory (${value}), treating as not specified.`);
            return undefined;
        }
    } catch (_) {
        // Unreadable path: leave it to the consumer to report a useful error.
    }

    return value;
}

/**
 * Derive the credentials that make go-sqlcmd authenticate as the Azure service connection
 * rather than the agent's ambient identity.
 *
 * Each service connection scheme is backed by a different azidentity credential, so the
 * mechanism differs:
 *
 *   ServicePrincipal           → EnvironmentCredential, via AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET.
 *   WorkloadIdentityFederation → AzurePipelinesCredential, via the ActiveDirectoryAzurePipelines method.
 *                                DefaultAzureCredential cannot be used: EnvironmentCredential needs a client
 *                                secret and WorkloadIdentityCredential needs AZURE_FEDERATED_TOKEN_FILE, so the
 *                                chain would silently fall through to the agent's identity.
 *   ManagedServiceIdentity     → nothing to inject; the service connection *is* the agent's managed identity,
 *                                which DefaultAzureCredential already resolves.
 *
 * `Authentication=Active Directory Managed Identity` is deliberately excluded. That value is an
 * explicit request for the agent's managed identity, so the service connection identity must not be
 * substituted for it — doing so would silently authenticate as a different (often broader) principal
 * when `azureSubscription` was supplied only for firewall management.
 *
 * Reads endpoint fields only — it acquires no tokens, so it is safe to call before ARM operations.
 */
function resolveSqlcmdCredentials(
    connectionConfig: SqlConnectionConfig,
    azureSubscription: string,
    azureEndpoint: any
): SqlcmdCredentials | undefined {
    if (!azureEndpoint?.tenantID) {
        return undefined;
    }

    const sqlAuthType = (connectionConfig.FormattedAuthentication ?? '').toLowerCase();
    const scheme = (azureEndpoint.scheme ?? '').toLowerCase();

    // Auth types where the connection string names no identity at all, so the identity
    // must come from the service connection. `Active Directory Managed Identity` is not
    // one of them: it names the agent's managed identity explicitly.
    const tokenBasedAuthTypes = ['activedirectorydefault', 'activedirectoryintegrated'];

    if (tokenBasedAuthTypes.includes(sqlAuthType)) {
        if (scheme === 'workloadidentityfederation') {
            // AzurePipelinesCredential exchanges the pipeline's OIDC token for a service
            // connection token, so it needs the job's own access token.
            const systemAccessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
            if (!azureEndpoint.servicePrincipalClientID || !systemAccessToken) {
                tl.warning(tl.loc('WifSqlcmdFallbackToAgentIdentity'));
                return undefined;
            }
            tl.setSecret(systemAccessToken);
            return {
                tenantId: azureEndpoint.tenantID,
                authMethodOverride: 'ActiveDirectoryAzurePipelines',
                source: 'azurePipelines',
                envOverrides: {
                    AZURESUBSCRIPTION_SERVICE_CONNECTION_ID: azureSubscription,
                    AZURESUBSCRIPTION_CLIENT_ID: azureEndpoint.servicePrincipalClientID,
                    AZURESUBSCRIPTION_TENANT_ID: azureEndpoint.tenantID,
                    SYSTEM_ACCESSTOKEN: systemAccessToken
                }
            };
        }

        if (scheme === 'serviceprincipal' && azureEndpoint.servicePrincipalClientID && azureEndpoint.servicePrincipalKey) {
            tl.setSecret(azureEndpoint.servicePrincipalKey);
            return {
                tenantId: azureEndpoint.tenantID,
                source: 'clientSecret',
                envOverrides: {
                    AZURE_TENANT_ID: azureEndpoint.tenantID,
                    AZURE_CLIENT_ID: azureEndpoint.servicePrincipalClientID,
                    AZURE_CLIENT_SECRET: azureEndpoint.servicePrincipalKey
                }
            };
        }

        // Certificate-backed service principals use the ServicePrincipal scheme but carry a PEM
        // instead of servicePrincipalKey, so the branch above does not match them. AzureRMEndpoint
        // writes the PEM to disk, and EnvironmentCredential reads AZURE_CLIENT_CERTIFICATE_PATH.
        // Without this, the identity is never injected and azidentity falls back to
        // DefaultAzureCredential, which resolves nothing on a hosted agent.
        if (scheme === 'serviceprincipal' && azureEndpoint.servicePrincipalClientID && azureEndpoint.servicePrincipalCertificatePath) {
            return {
                tenantId: azureEndpoint.tenantID,
                source: 'clientCertificate',
                envOverrides: {
                    AZURE_TENANT_ID: azureEndpoint.tenantID,
                    AZURE_CLIENT_ID: azureEndpoint.servicePrincipalClientID,
                    AZURE_CLIENT_CERTIFICATE_PATH: azureEndpoint.servicePrincipalCertificatePath
                }
            };
        }

        // ManagedServiceIdentity, or an incomplete endpoint: DefaultAzureCredential resolves
        // the agent's managed identity, which is the service connection identity.
        return undefined;
    }

    if (sqlAuthType === 'activedirectoryserviceprincipal') {
        // Credentials come from the connection string, but go-mssqldb still needs a tenant.
        // Supply the service connection's so the clientId@tenantId user name can be built.
        return { tenantId: azureEndpoint.tenantID };
    }

    return undefined;
}

main();
