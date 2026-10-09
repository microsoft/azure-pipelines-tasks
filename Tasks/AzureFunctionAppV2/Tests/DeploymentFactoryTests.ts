import * as assert from 'assert';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';

process.env['AGENT_TEMPDIRECTORY'] = process.env['AGENT_TEMPDIRECTORY'] || process.cwd();

// Require after env setup because azure-arm-rest reads agent temp path at module load time.
const DeploymentFactory = require('../deploymentProvider/DeploymentFactory').DeploymentFactory;
const DeploymentType = require('../taskparameters').DeploymentType;

type MockTaskParameters = {
    isLinuxApp?: boolean;
    isConsumption?: boolean;
    isFlexConsumption?: boolean;
    isPremium?: boolean;
    DeploymentType?: number;
    Package?: {
        getPackageType: () => PackageType;
        isMSBuildPackage: () => Promise<boolean>;
        getPath: () => string;
    };
};

function createTaskParameters(overrides: Partial<MockTaskParameters> = {}): MockTaskParameters {
    return {
        isLinuxApp: false,
        isConsumption: false,
        isFlexConsumption: false,
        isPremium: false,
        DeploymentType: DeploymentType.auto,
        Package: {
            getPackageType: () => PackageType.zip,
            isMSBuildPackage: async () => false,
            getPath: () => 'webAppPkg.zip'
        },
        ...overrides
    };
}

async function getProviderName(taskParams: MockTaskParameters): Promise<string | undefined> {
    const provider = await new DeploymentFactory(taskParams as any).GetDeploymentProvider();
    return provider ? provider.constructor.name : undefined;
}

describe('DeploymentFactory Tests', function () {
    it('routes Linux consumption app to ConsumptionWebAppDeploymentProvider', async function () {
        const result = await getProviderName(createTaskParameters({ isLinuxApp: true, isConsumption: true }));
        assert.strictEqual(result, 'ConsumptionWebAppDeploymentProvider');
    });

    it('routes Linux flex consumption app to FlexConsumptionWebAppDeploymentProvider', async function () {
        const result = await getProviderName(createTaskParameters({
            isLinuxApp: true,
            isConsumption: false,
            isFlexConsumption: true
        }));
        assert.strictEqual(result, 'FlexConsumptionWebAppDeploymentProvider');
    });

    it('routes Linux non-consumption non-flex app to BuiltInLinuxWebAppDeploymentProvider', async function () {
        const result = await getProviderName(createTaskParameters({
            isLinuxApp: true,
            isConsumption: false,
            isFlexConsumption: false
        }));
        assert.strictEqual(result, 'BuiltInLinuxWebAppDeploymentProvider');
    });

    it('routes Linux premium app to BuiltInLinuxWebAppDeploymentProvider', async function () {
        const result = await getProviderName(createTaskParameters({
            isLinuxApp: true,
            isConsumption: false,
            isFlexConsumption: false,
            isPremium: true
        }));
        assert.strictEqual(result, 'BuiltInLinuxWebAppDeploymentProvider');
    });

    it('prioritizes consumption over flex consumption for Linux', async function () {
        const result = await getProviderName(createTaskParameters({
            isLinuxApp: true,
            isConsumption: true,
            isFlexConsumption: true
        }));
        assert.strictEqual(result, 'ConsumptionWebAppDeploymentProvider');
    });

    it('routes Windows JAR package to WindowsWebAppZipDeployProvider', async function () {
        const result = await getProviderName(createTaskParameters({
            Package: {
                getPackageType: () => PackageType.jar,
                isMSBuildPackage: async () => false,
                getPath: () => 'webAppPkg.jar'
            }
        }));
        assert.strictEqual(result, 'WindowsWebAppZipDeployProvider');
    });

    it('routes Windows zip with zipDeploy method to WindowsWebAppZipDeployProvider', async function () {
        const result = await getProviderName(createTaskParameters({ DeploymentType: DeploymentType.zipDeploy }));
        assert.strictEqual(result, 'WindowsWebAppZipDeployProvider');
    });

    it('routes Windows zip with runFromPackage method to WindowsWebAppRunFromZipProvider', async function () {
        const result = await getProviderName(createTaskParameters({ DeploymentType: DeploymentType.runFromPackage }));
        assert.strictEqual(result, 'WindowsWebAppRunFromZipProvider');
    });

    it('routes Windows zip with auto method to WindowsWebAppRunFromZipProvider', async function () {
        const result = await getProviderName(createTaskParameters({ DeploymentType: DeploymentType.auto }));
        assert.strictEqual(result, 'WindowsWebAppRunFromZipProvider');
    });

    it('throws for Windows auto deployment with MSBuild package', async function () {
        await assert.rejects(
            async () => {
                await getProviderName(createTaskParameters({
                    DeploymentType: DeploymentType.auto,
                    Package: {
                        getPackageType: () => PackageType.zip,
                        isMSBuildPackage: async () => true,
                        getPath: () => 'msbuild.zip'
                    }
                }));
            },
            /MsBuildPackageNotSupported/
        );
    });

    it('returns undefined for Windows zip with unmatched deployment method (current behavior)', async function () {
        const result = await getProviderName(createTaskParameters({ DeploymentType: 3 }));
        assert.strictEqual(result, undefined);
    });
});
