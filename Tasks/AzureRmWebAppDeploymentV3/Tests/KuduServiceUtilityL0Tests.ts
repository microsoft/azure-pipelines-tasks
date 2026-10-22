import * as assert from 'assert';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';
import { format } from 'util';

const [packagePath, physicalPath, displayedPackagePath, displayedPhysicalPath] = process.argv.slice(2);
let extractionCount = 0;

mocker.enable({ warnOnUnregistered: false });
mocker.registerMock('azure-pipelines-task-lib/task', {
    stats: (value: string) => {
        assert.strictEqual(value, packagePath);
        return { isDirectory: () => false };
    },
    loc: (key: string, ...args: string[]) => {
        if (key === 'PackageDeploymentFailed') {
            return key;
        }
        assert.strictEqual(key, 'Successfullydeployedpackageusingkuduserviceat');
        assert.deepStrictEqual(args, [displayedPackagePath, displayedPhysicalPath]);
        return format('Successfully deployed package %s using kudu service at %s', ...args);
    },
    error: (message: string) => console.error(message)
});
mocker.registerMock('azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu', {
    Kudu: class {
        async extractZIP(actualPackagePath: string, actualPhysicalPath: string): Promise<void> {
            assert.strictEqual(actualPackagePath, packagePath);
            assert.strictEqual(actualPhysicalPath, physicalPath);
            extractionCount++;
        }
    }
});
mocker.registerMock('azure-pipelines-tasks-webdeployment-common/utility', {});
mocker.registerMock('azure-pipelines-tasks-webdeployment-common/utility.js', {});
mocker.registerMock('azure-pipelines-tasks-webdeployment-common/ziputility', {});
mocker.registerMock('azure-pipelines-tasks-webdeployment-common/ziputility.js', {});
mocker.registerMock('azure-pipelines-tasks-webdeployment-common/packageUtility', { PackageType: {} });
mocker.registerMock('azure-pipelines-tasks-azure-arm-rest/webClient', {});

async function run(): Promise<void> {
    const { KuduServiceUtility } = await import('../operations/KuduServiceUtility');
    const { Kudu } = await import('azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu');
    const utility = new KuduServiceUtility(new Kudu('https://example.invalid', 'unused'));
    await utility.deployWebPackage(packagePath, physicalPath, '/');
    assert.strictEqual(extractionCount, 1);
    console.log('Deployment arguments preserved');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
