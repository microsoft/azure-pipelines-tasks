import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import SqlPackageHelper from './src/SqlPackageHelper';
import SqlcmdHelper from './src/SqlcmdHelper';
import SqlConnectionConfig from './src/SqlConnectionConfig';
import SqlUtils from './src/SqlUtils';
import FirewallManager from './src/FirewallManager';
import AzureSqlResourceManager from './src/AzureSqlResourceManager';
import SqlProjectBuilder from './src/SqlProjectBuilder';
import { SqlPackageExecutor } from './src/SqlPackageExecutor';
import { SqlcmdExecutor } from './src/SqlcmdExecutor';

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

        tl.debug(tl.loc('StartingDeployment'));

        // Get required inputs per specification
        const action = tl.getInput('action', true)!;
        let filePath = tl.getInput('path', true)!;
        const connectionString = tl.getInput('connectionString', true)!;
        
        // Validate file path exists
        tl.checkPath(filePath, 'path');
        
        // Mask connection string (contains sensitive data)
        tl.setSecret(connectionString);
        tl.debug(tl.loc('ConnectionStringProvided'));

        // Get optional inputs
        const azureSubscription = tl.getInput('azureSubscription', false);
        const publishProfile = tl.getInput('publishProfile', false);
        const additionalArguments = tl.getInput('additionalArguments', false);
        const buildArguments = tl.getInput('buildArguments', false);
        const sqlpackagePath = tl.getInput('sqlpackagePath', false);
        const sqlcmdPath = tl.getInput('sqlcmdPath', false);
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
            tl.debug(tl.loc('UsingAzureSubscription', azureSubscription));
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

        tl.debug(tl.loc('ActionDetected', action, fileType));

        // Parse and validate connection string
        tl.debug(tl.loc('ParsingConnectionString'));
        const connectionConfig = new SqlConnectionConfig(connectionString);
        tl.debug(`Parsed connection string - Server: ${connectionConfig.Server}, Database: ${connectionConfig.Database}`);

        // Discover SqlPackage for DACPAC/SQLPROJ actions
        let sqlPackageExePath: string | undefined;
        const needsSqlPackage = (fileType === 'DACPAC' || fileType === 'SQLPROJ') && action !== 'sqlScript';
        
        if (needsSqlPackage) {
            tl.debug(tl.loc('DetectingSqlPackage'));
            sqlPackageExePath = await SqlPackageHelper.findSqlPackage(sqlpackagePath);
            tl.debug(tl.loc('SqlPackageFound', sqlPackageExePath));
        }

        // Discover sqlcmd for SQL script actions or firewall detection
        let sqlcmdExePath: string | undefined;
        const needsSqlcmd = action === 'sqlScript' || firewallRuleManagement;
        
        if (needsSqlcmd) {
            tl.debug(tl.loc('SettingUpSqlCmd'));
            sqlcmdExePath = await SqlcmdHelper.findSqlcmd(sqlcmdPath);
            tl.debug(tl.loc('SqlCmdFound', sqlcmdExePath));
        }

        // Firewall management and deployment execution
        let firewallManager: FirewallManager | undefined;
        let accessToken: string | undefined;
        
        try {
            // Step 1: Firewall rule management and token acquisition (if azureSubscription set)
            if (azureSubscription) {
                try {
                    const { AzureRMEndpoint } = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint');
                    const { AzureEndpoint } = require('azure-pipelines-tasks-azure-arm-rest/azureModels');
                    
                    const azureEndpoint: typeof AzureEndpoint = await new AzureRMEndpoint(azureSubscription).getEndpoint();

                    // Acquire access token for database authentication
                    if (azureEndpoint.scheme === 'ServicePrincipal' || azureEndpoint.scheme === 'WorkloadIdentityFederation' || azureEndpoint.scheme === 'ManagedServiceIdentity') {
                        try {
                            accessToken = await azureEndpoint.getToken();
                            if (accessToken) {
                                tl.setSecret(accessToken);
                                tl.debug(tl.loc('AccessTokenAcquired'));
                            }
                        } catch (tokenError) {
                            tl.debug(`Access token acquisition failed (non-fatal): ${tokenError.message || tokenError}`);
                        }
                    }

                    if (firewallRuleManagement) {
                        // Detect IP address by testing connectivity
                        const ipAddress = await SqlUtils.detectIPAddress(connectionConfig, sqlcmdExePath!);
                        
                        if (ipAddress) {
                            const resourceManager = await AzureSqlResourceManager.getResourceManager(
                                connectionConfig.Server,
                                azureEndpoint
                            );
                            firewallManager = new FirewallManager(resourceManager);
                            await firewallManager.addFirewallRule(ipAddress);
                        }
                    }
                } catch (error) {
                    tl.warning(`Azure service connection operation failed: ${error.message || error}`);
                    throw error;
                }
            } else if (!firewallRuleManagement) {
                tl.debug(tl.loc('FirewallManagementDisabled'));
            }

            // Step 2: SQL project build (if .sqlproj)
            if (fileType === 'SQLPROJ') {
                tl.debug(tl.loc('BuildingSqlProject', filePath));
                const builtDacpacPath = await SqlProjectBuilder.buildProject(filePath, buildArguments);
                // Update path to point to built .dacpac
                filePath = builtDacpacPath;
                fileType = 'DACPAC';
                tl.debug(tl.loc('SqlProjectBuildComplete', filePath));
            }

            // Step 3: Execute deployment (SqlPackage or sqlcmd)
            let outputFilePath: string | undefined;
            
            if (fileType === 'DACPAC' || (fileType === 'SQL' && action !== 'sqlScript')) {
                // Execute with SqlPackage (for DACPAC or SQL with script/deployReport action)
                tl.debug(tl.loc('ExecutingSqlPackage', action));
                outputFilePath = await SqlPackageExecutor.executeSqlPackage(
                    sqlPackageExePath!,
                    action,
                    filePath,
                    connectionConfig,
                    publishProfile,
                    additionalArguments,
                    accessToken
                );
            } else if (fileType === 'SQL' && action === 'sqlScript') {
                // Execute with sqlcmd (for SQL scripts)
                tl.debug(tl.loc('ExecutingSqlScript', filePath));
                await SqlcmdExecutor.executeSqlcmd(
                    sqlcmdExePath!,
                    filePath,
                    connectionConfig,
                    additionalArguments,
                    accessToken
                );
            }

            // Step 4: Set output variables
            if (outputFilePath) {
                tl.debug(tl.loc('OutputFileGenerated', outputFilePath));
                tl.setVariable('SqlDeploymentOutputFile', outputFilePath);
            }

            tl.debug(tl.loc('DeploymentSuccessful'));
        } finally {
            // Always cleanup firewall rule
            if (firewallManager) {
                try {
                    await firewallManager.removeFirewallRule();
                } catch (cleanupError) {
                    tl.warning(`Failed to cleanup firewall rule: ${cleanupError.message || cleanupError}`);
                }
            }
        }
    }
    catch (error) {
        tl.debug(`Deployment failed with error: ${error}`);
        tl.setResult(tl.TaskResult.Failed, tl.loc('DeploymentFailed', error.message || error));
    }
}

main();
