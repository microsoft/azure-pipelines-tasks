import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import SqlPackageHelper from './SqlPackageHelper';
import SqlcmdHelper from './SqlcmdHelper';
import SqlConnectionConfig from './SqlConnectionConfig';
import SqlUtils from './SqlUtils';
import FirewallManager from './FirewallManager';
import AzureSqlResourceManager from './AzureSqlResourceManager';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';

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
        tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

        tl.debug(tl.loc('StartingDeployment'));

        // Get required inputs per specification
        const action = tl.getInput('action', true)!;
        const filePath = tl.getInput('path', true)!;
        const connectionString = tl.getInput('connectionString', true)!;
        
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
        const needsSqlcmd = action === 'sqlScript' || (fileType === 'SQL' && action === 'script') || firewallRuleManagement;
        
        if (needsSqlcmd) {
            tl.debug(tl.loc('SettingUpSqlCmd'));
            sqlcmdExePath = await SqlcmdHelper.findSqlcmd(sqlcmdPath);
            tl.debug(tl.loc('SqlcmdFound', sqlcmdExePath));
        }

        // Firewall management and deployment execution
        let firewallManager: FirewallManager | undefined;
        
        try {
            // Step 1: Firewall rule management (if enabled)
            if (firewallRuleManagement && azureSubscription) {
                try {
                    // Get Azure endpoint with credentials
                    const azureEndpoint: AzureEndpoint = await new AzureRMEndpoint(azureSubscription).getEndpoint();
                    
                    // Detect IP address by testing connectivity
                    const ipAddress = await SqlUtils.detectIPAddress(connectionConfig, sqlcmdExePath!);
                    
                    // Add firewall rule only if IP address was detected (connection blocked)
                    if (ipAddress) {
                        const resourceManager = await AzureSqlResourceManager.getResourceManager(
                            connectionConfig.Server,
                            azureEndpoint
                        );
                        firewallManager = new FirewallManager(resourceManager);
                        await firewallManager.addFirewallRule(ipAddress);
                    }
                } catch (error) {
                    tl.warning(`Firewall rule management failed: ${error.message || error}`);
                    throw error;
                }
            } else if (!firewallRuleManagement) {
                tl.debug(tl.loc('FirewallManagementDisabled'));
            }

            // Step 2: SQL project build (if .sqlproj)
            // TODO: Implement SQL project build with dotnet build

            // Step 3: Execute deployment (SqlPackage or sqlcmd)
            // TODO: Implement SqlPackage execution
            // TODO: Implement sqlcmd execution
            // TODO: Set output variables

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
