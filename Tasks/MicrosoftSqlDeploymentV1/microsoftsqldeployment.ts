import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import SqlPackageHelper from './src/SqlPackageHelper';
import SqlcmdHelper from './src/SqlcmdHelper';
import SqlConnectionConfig from './src/SqlConnectionConfig';
import SqlUtils from './src/SqlUtils';
import FirewallManager from './src/FirewallManager';
import AzureSqlResourceManager from './src/AzureSqlResourceManager';
import SqlProjectBuilder from './src/SqlProjectBuilder';


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
        const action = tl.getInput('action', true)!;
        const filePath = tl.getInput('path', true)!;
        const connectionString = tl.getInput('connectionString', true)!;
        
        // Mask connection string (contains sensitive data)
        tl.setSecret(connectionString);
        console.log(tl.loc('ConnectionStringProvided'));

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

        console.log(tl.loc('ActionDetected', action, fileType));

        // Parse and validate connection string
        console.log(tl.loc('ParsingConnectionString'));
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

        // Discover sqlcmd for SQL script actions
        let sqlcmdExePath: string | undefined;
        const needsSqlcmd = action === 'sqlScript' || (fileType === 'SQL' && action === 'script');
        
        if (needsSqlcmd) {
            tl.debug(tl.loc('SettingUpSqlCmd'));
            sqlcmdExePath = await SqlcmdHelper.findSqlcmd(sqlcmdPath);
            tl.debug(tl.loc('SqlCmdFound', sqlcmdExePath));
        }

        // SQL project build (if .sqlproj)
        let resolvedFilePath = filePath;
        if (fileType === 'SQLPROJ') {
            resolvedFilePath = await SqlProjectBuilder.buildProject(filePath, buildArguments || undefined);
        }

        // Firewall rule management
        let firewallManager: FirewallManager | undefined;
        try {
            if (firewallRuleManagement && azureSubscription) {
                const { AzureRMEndpoint } = require('azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint');
                const azureEndpoint = await new AzureRMEndpoint(azureSubscription).getEndpoint();
                const ipAddress = await SqlUtils.detectIPAddress(connectionConfig, sqlcmdExePath!);
                if (ipAddress) {
                    const resourceManager = await AzureSqlResourceManager.getResourceManager(connectionConfig.Server, azureEndpoint);
                    firewallManager = new FirewallManager(resourceManager);
                    await firewallManager.addFirewallRule(ipAddress);
                }
            } else if (!firewallRuleManagement) {
                tl.debug(tl.loc('FirewallManagementDisabled'));
            }

            // TODO (task4): SqlPackage execution and sqlcmd execution
            // resolvedFilePath and sqlPackageExePath/sqlcmdExePath are ready for task4

            console.log(tl.loc('DeploymentSuccessful'));
        } finally {
            if (firewallManager) {
                await firewallManager.removeFirewallRule();
            }
        }
    }
    catch (error) {
        tl.debug(`Deployment failed with error: ${error}`);
        tl.setResult(tl.TaskResult.Failed, tl.loc('DeploymentFailed', error.message || error));
    }
}

main();
