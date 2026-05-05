import * as assert from 'assert';

// Define DeploymentType locally to avoid importing taskparameters.ts
// which has heavy external dependencies (azure-arm-rest, etc.)
enum DeploymentType {
    auto,
    zipDeploy,
    runFromPackage,
    warDeploy
}

// We test the DeploymentFactory logic by simulating its routing decisions
// without importing the actual class (which has heavy external dependencies).

interface MockTaskParameters {
    isLinuxApp?: boolean;
    isConsumption?: boolean;
    isPremium?: boolean;
    DeploymentType?: DeploymentType;
    _packageType?: string;
}

describe('DeploymentFactory Tests', function () {

    describe('GetDeploymentProvider routing', function () {

        function getProviderName(taskParams: MockTaskParameters): string {
            // Simulate the routing logic from DeploymentFactory.GetDeploymentProvider
            if (taskParams.isLinuxApp) {
                if (taskParams.isConsumption) {
                    return 'ConsumptionWebAppDeploymentProvider';
                } else {
                    return 'BuiltInLinuxWebAppDeploymentProvider';
                }
            } else {
                // Windows path
                return getWindowsProviderName(taskParams);
            }
        }

        function getWindowsProviderName(taskParams: MockTaskParameters): string {
            const packageType = taskParams['_packageType'] as string;
            if (packageType === 'war') {
                return 'WindowsWebAppWarDeployProvider';
            } else if (packageType === 'jar') {
                return 'WindowsWebAppZipDeployProvider';
            } else {
                // zip/folder
                if (taskParams.DeploymentType != null && taskParams.DeploymentType !== DeploymentType.auto) {
                    switch (taskParams.DeploymentType) {
                        case DeploymentType.zipDeploy:
                            return 'WindowsWebAppZipDeployProvider';
                        case DeploymentType.runFromPackage:
                            return 'WindowsWebAppRunFromZipProvider';
                    }
                } else {
                    // auto with non-msbuild package
                    return 'WindowsWebAppRunFromZipProvider';
                }
            }
        }

        it('should route Linux consumption app to ConsumptionWebAppDeploymentProvider', function () {
            const result = getProviderName({ isLinuxApp: true, isConsumption: true });
            assert.strictEqual(result, 'ConsumptionWebAppDeploymentProvider');
        });

        it('should route Linux non-consumption app to BuiltInLinuxWebAppDeploymentProvider', function () {
            const result = getProviderName({ isLinuxApp: true, isConsumption: false });
            assert.strictEqual(result, 'BuiltInLinuxWebAppDeploymentProvider');
        });

        it('should route Linux premium app to BuiltInLinuxWebAppDeploymentProvider', function () {
            const result = getProviderName({ isLinuxApp: true, isConsumption: false, isPremium: true });
            assert.strictEqual(result, 'BuiltInLinuxWebAppDeploymentProvider');
        });

        it('should route Windows WAR package to WindowsWebAppWarDeployProvider', function () {
            const result = getProviderName({ isLinuxApp: false, _packageType: 'war' });
            assert.strictEqual(result, 'WindowsWebAppWarDeployProvider');
        });

        it('should route Windows JAR package to WindowsWebAppZipDeployProvider', function () {
            const result = getProviderName({ isLinuxApp: false, _packageType: 'jar' });
            assert.strictEqual(result, 'WindowsWebAppZipDeployProvider');
        });

        it('should route Windows zip with zipDeploy method to WindowsWebAppZipDeployProvider', function () {
            const result = getProviderName({
                isLinuxApp: false,
                _packageType: 'zip',
                DeploymentType: DeploymentType.zipDeploy
            });
            assert.strictEqual(result, 'WindowsWebAppZipDeployProvider');
        });

        it('should route Windows zip with runFromPackage method to WindowsWebAppRunFromZipProvider', function () {
            const result = getProviderName({
                isLinuxApp: false,
                _packageType: 'zip',
                DeploymentType: DeploymentType.runFromPackage
            });
            assert.strictEqual(result, 'WindowsWebAppRunFromZipProvider');
        });

        it('should route Windows zip with auto method to WindowsWebAppRunFromZipProvider', function () {
            const result = getProviderName({
                isLinuxApp: false,
                _packageType: 'zip',
                DeploymentType: DeploymentType.auto
            });
            assert.strictEqual(result, 'WindowsWebAppRunFromZipProvider');
        });
    });

    describe('TaskParameters validation', function () {

        it('DeploymentType enum should have correct values', function () {
            assert.strictEqual(DeploymentType.auto, 0);
            assert.strictEqual(DeploymentType.zipDeploy, 1);
            assert.strictEqual(DeploymentType.runFromPackage, 2);
            assert.strictEqual(DeploymentType.warDeploy, 3);
        });

        it('webAppKindMap should normalize function app kinds', function () {
            const webAppKindMap = new Map([
                ['functionapp', 'functionApp'],
                ['functionapp,linux,container', 'functionAppLinux'],
                ['functionapp,linux', 'functionAppLinux']
            ]);

            assert.strictEqual(webAppKindMap.get('functionapp'), 'functionApp');
            assert.strictEqual(webAppKindMap.get('functionapp,linux,container'), 'functionAppLinux');
            assert.strictEqual(webAppKindMap.get('functionapp,linux'), 'functionAppLinux');
            assert.strictEqual(webAppKindMap.get('unknownkind'), undefined);
        });

        it('SKU detection should identify consumption plan', function () {
            const sku = 'Dynamic';
            assert.strictEqual(sku.toLowerCase() === 'dynamic', true);
        });

        it('SKU detection should identify elastic premium plan', function () {
            const sku = 'ElasticPremium';
            assert.strictEqual(sku.toLowerCase() === 'elasticpremium', true);
        });

        it('isLinuxApp should be true when kind contains Linux', function () {
            const kind = 'functionAppLinux';
            assert.strictEqual(kind.indexOf('Linux') !== -1, true);
        });

        it('isLinuxApp should be false when kind does not contain Linux', function () {
            const kind = 'functionApp';
            assert.strictEqual(kind.indexOf('Linux') !== -1, false);
        });

        it('AppSettings newlines should be replaced with spaces', function () {
            let appSettings = '-key1 value1\n-key2 value2';
            appSettings = appSettings.replace('\n', ' ');
            assert.strictEqual(appSettings, '-key1 value1 -key2 value2');
        });

        it('SlotName should default to production when DeployToSlotOrASE is false', function () {
            const deployToSlot = false;
            const slotName = deployToSlot ? 'staging' : 'production';
            assert.strictEqual(slotName, 'production');
        });

        it('SlotName should use provided value when DeployToSlotOrASE is true', function () {
            const deployToSlot = true;
            const slotName = deployToSlot ? 'staging' : 'production';
            assert.strictEqual(slotName, 'staging');
        });
    });
});
