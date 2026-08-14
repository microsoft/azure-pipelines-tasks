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

        if (azureSubscription) {
            console.log(tl.loc('UsingAzureSubscription', azureSubscription));
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

        // tl.checkPath only tests existence, so a directory satisfies it. A directory named with a
        // supported extension would otherwise be handed to SqlPackage or sqlcmd, which fail with a
        // message about the tool rather than about the input. The other file inputs already reject
        // a directory, so this keeps the main input consistent with them.
        if (isDirectory(filePath)) {
            throw new Error(tl.loc('FilePathInputIsDirectory', 'path', filePath));
        }

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

        // Firewall rules are an Azure SQL Database concept, so the target has to be known before this
        // can be decided. Defaulting on the presence of azureSubscription alone would enable the
        // step for managed instances, Fabric and on-premises servers, where the rule can never be
        // created and the run fails late while looking the server up in ARM.
        let firewallRuleManagement: boolean;
        if (!firewallRuleManagementInput) {
            firewallRuleManagement = !!azureSubscription && connectionConfig.IsAzureSqlDatabaseServer;
            tl.debug(`firewallRuleManagement defaulted to: ${firewallRuleManagement}`);
        } else {
            firewallRuleManagement = firewallRuleManagementInput.toLowerCase() === 'true';
            tl.debug(`firewallRuleManagement explicitly set to: ${firewallRuleManagement}`);
        }

        if (firewallRuleManagement && !azureSubscription) {
            throw new Error(tl.loc('FirewallManagementRequiresAzureSubscription'));
        }

        // An explicit request for an unsupported target is reported here, rather than as a confusing
        // "server not found in subscription" once the ARM enumeration has already run.
        if (firewallRuleManagement && !connectionConfig.IsAzureSqlDatabaseServer) {
            throw new Error(tl.loc('FirewallManagementRequiresAzureSqlDatabase', connectionConfig.Server));
        }

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

                // Acquire the SQL-scoped token only for auth types that consume it.
                // Gating on the same condition SqlPackageExecutor uses avoids pointless token
                // requests for SQL auth, AAD Password and AAD Service Principal, which carry their
                // own credentials. `Active Directory Integrated` is excluded because it names the
                // caller's domain identity, and handing SqlPackage a service connection token would
                // deploy as a different principal than the one requested.
                const tokenBasedAuthTypes = ['activedirectorydefault'];
                const authType = (connectionConfig.FormattedAuthentication ?? '').toLowerCase();
                const endpointScheme = normalizeEndpointScheme(azureEndpoint);
                const shouldAcquireToken = tokenBasedAuthTypes.includes(authType) &&
                    (endpointScheme === 'serviceprincipal' ||
                     endpointScheme === 'workloadidentityfederation' ||
                     endpointScheme === 'managedserviceidentity');

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
                        // Deliberately fatal. Continuing would drop /AccessToken and hand
                        // SqlPackage a connection string carrying Authentication=Active Directory
                        // Default, so it would run its own credential chain and could deploy as the
                        // agent's managed identity or a stale az login session. That identity often
                        // holds broader permissions than the service connection the user selected,
                        // and the run would still report success.
                        throw new Error(tl.loc('AccessTokenAcquisitionFailed', azureSubscription, tokenError.message || tokenError));
                    }

                    if (!accessToken) {
                        throw new Error(tl.loc('AccessTokenAcquisitionFailed', azureSubscription, 'no token was returned'));
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
 * True when the path exists and is a directory.
 *
 * An unreadable path reports false so the caller's own error surfaces instead of one about the
 * stat call.
 */
function isDirectory(value: string): boolean {
    try {
        return fs.existsSync(value) && fs.statSync(value).isDirectory();
    } catch (_) {
        return false;
    }
}

/**
 * Read an optional filePath input, returning undefined when the user left it blank.
 *
 * The agent roots filePath inputs before the task sees them, so an unset one arrives as
 * System.DefaultWorkingDirectory rather than an empty string. Passing that through makes the
 * task treat the repo root as a user-supplied executable or profile.
 *
 * tl.filePathSupplied distinguishes the two cases, which matters because the handling differs:
 * an unset input falls back to discovery, while a supplied one that points at a directory is a
 * mistake worth reporting. Ignoring the latter would run SqlPackage without /Profile and report
 * success, deploying with default properties instead of the requested publish profile.
 */
function getOptionalFilePathInput(name: string): string | undefined {
    if (!tl.filePathSupplied(name)) {
        return undefined;
    }

    const raw = tl.getInput(name, false);
    if (!raw || !raw.trim()) {
        return undefined;
    }

    const value = raw.trim();

    if (isDirectory(value)) {
        throw new Error(tl.loc('FilePathInputIsDirectory', name, value));
    }

    return value;
}

// AzureRMEndpoint passes the scheme through unnormalized and treats an absent scheme as ServicePrincipal.
function normalizeEndpointScheme(azureEndpoint: any): string {
    return (azureEndpoint?.scheme ?? '').toLowerCase() || 'serviceprincipal';
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
 *   ManagedServiceIdentity     → ActiveDirectoryManagedIdentity, carrying the endpoint's msiClientId when the
 *                                identity is user-assigned. DefaultAzureCredential is not enough on its own:
 *                                it tries environment and Azure CLI credentials before managed identity, so
 *                                the agent's identity is not guaranteed to be the one that authenticates.
 *
 * Any other scheme — Publish Profile, or one this task does not recognise — is rejected rather than
 * left to DefaultAzureCredential, which would resolve the agent's identity instead of the selected
 * service connection.
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
    const sqlAuthType = (connectionConfig.FormattedAuthentication ?? '').toLowerCase();
    const scheme = normalizeEndpointScheme(azureEndpoint);

    // Auth types where the connection string names no identity at all, so the identity
    // must come from the service connection. `Active Directory Managed Identity` and
    // `Active Directory Integrated` are not among them: each names an identity explicitly,
    // and substituting the service connection would authenticate as a different principal.
    const tokenBasedAuthTypes = ['activedirectorydefault'];

    if (tokenBasedAuthTypes.includes(sqlAuthType)) {
        // azidentity defaults to the public cloud when neither its cloud options nor
        // AZURE_AUTHORITY_HOST is set, so a sovereign sign-in would contact login.microsoftonline.com
        // even though the endpoint names a different authority. Every credential path below carries
        // it for that reason.
        const authorityOverrides: { [key: string]: string } = azureEndpoint?.environmentAuthorityUrl
            ? { AZURE_AUTHORITY_HOST: azureEndpoint.environmentAuthorityUrl }
            : {};

        // Pinned to the managed identity rather than left to DefaultAzureCredential, whose chain
        // reaches environment and Azure CLI credentials first.
        if (scheme === 'managedserviceidentity') {
            return {
                authMethodOverride: 'ActiveDirectoryManagedIdentity',
                // Absent for a system-assigned identity, which go-sqlcmd selects with no user id.
                userIdOverride: azureEndpoint.msiClientId || undefined,
                source: 'managedIdentity',
                envOverrides: authorityOverrides
            };
        }

        // The scheme is inspected before the tenant. A Publish Profile endpoint carries no
        // tenantID, so checking the tenant first returned undefined here and left sqlcmd running
        // under whatever ambient identity the agent holds.
        if ((scheme !== 'serviceprincipal' && scheme !== 'workloadidentityfederation') || !azureEndpoint.tenantID) {
            throw new Error(tl.loc('ServiceConnectionCredentialsUnavailable', azureSubscription));
        }

        if (scheme === 'workloadidentityfederation') {
            // AzurePipelinesCredential exchanges the pipeline's OIDC token for a service
            // connection token, so it needs the job's own access token.
            const systemAccessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
            if (!azureEndpoint.servicePrincipalClientID || !systemAccessToken) {
                // Returning undefined here would run sqlcmd with ActiveDirectoryDefault and no
                // service connection environment, so azidentity would resolve whatever ambient
                // credential the agent happens to carry. The user selected a service connection;
                // deploying as a different principal is worse than not deploying.
                throw new Error(tl.loc('ServiceConnectionCredentialsUnavailable', azureSubscription));
            }
            tl.setSecret(systemAccessToken);
            return {
                tenantId: azureEndpoint.tenantID,
                authMethodOverride: 'ActiveDirectoryAzurePipelines',
                source: 'azurePipelines',
                envOverrides: Object.assign({
                    AZURESUBSCRIPTION_SERVICE_CONNECTION_ID: azureSubscription,
                    AZURESUBSCRIPTION_CLIENT_ID: azureEndpoint.servicePrincipalClientID,
                    AZURESUBSCRIPTION_TENANT_ID: azureEndpoint.tenantID,
                    SYSTEM_ACCESSTOKEN: systemAccessToken
                }, authorityOverrides)
            };
        }

        if (scheme === 'serviceprincipal' && azureEndpoint.servicePrincipalClientID && azureEndpoint.servicePrincipalKey) {
            tl.setSecret(azureEndpoint.servicePrincipalKey);
            return {
                tenantId: azureEndpoint.tenantID,
                source: 'clientSecret',
                envOverrides: Object.assign({
                    AZURE_TENANT_ID: azureEndpoint.tenantID,
                    AZURE_CLIENT_ID: azureEndpoint.servicePrincipalClientID,
                    AZURE_CLIENT_SECRET: azureEndpoint.servicePrincipalKey
                }, authorityOverrides)
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
                envOverrides: Object.assign({
                    AZURE_TENANT_ID: azureEndpoint.tenantID,
                    AZURE_CLIENT_ID: azureEndpoint.servicePrincipalClientID,
                    AZURE_CLIENT_CERTIFICATE_PATH: azureEndpoint.servicePrincipalCertificatePath
                }, authorityOverrides)
            };
        }

        // A ServicePrincipal endpoint reaching this point carries neither a client secret nor a
        // certificate, so there is no credential material to inject.
        throw new Error(tl.loc('ServiceConnectionCredentialsUnavailable', azureSubscription));
    }

    if (sqlAuthType === 'activedirectoryserviceprincipal') {
        // Credentials come from the connection string, but go-mssqldb still needs a tenant.
        // Supply the service connection's so the clientId@tenantId user name can be built.
        if (!azureEndpoint?.tenantID) {
            return undefined;
        }
        return { tenantId: azureEndpoint.tenantID, source: 'tenantOnly' };
    }

    return undefined;
}

main();
