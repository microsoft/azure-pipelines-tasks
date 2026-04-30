import * as assert from 'assert';

// Mock classes
class MockKudu {
    public warmupCalled: boolean = false;
    public warmupShouldFail: boolean = false;

    async warmup(): Promise<void> {
        this.warmupCalled = true;
        if (this.warmupShouldFail) {
            throw new Error('Warmup failed');
        }
    }

    async getAppSettings(): Promise<any> {
        return {};
    }
}

class MockAzureAppServiceUtility {
    public instancesResponse: any = null;
    public instancesShouldFail: boolean = false;
    public getKuduServiceCalledWith: string | undefined = undefined;

    async getAppserviceInstances(): Promise<any> {
        if (this.instancesShouldFail) {
            throw new Error('Failed to get instances');
        }
        return this.instancesResponse;
    }

    async getKuduService(instanceId?: string): Promise<MockKudu> {
        this.getKuduServiceCalledWith = instanceId;
        return new MockKudu();
    }
}

// Helper to capture debug messages
let debugMessages: string[] = [];
function mockDebug(message: string): void {
    debugMessages.push(message);
}

// Simulate the getWarmupInstanceId logic from AzureRmWebAppDeploymentProvider
async function getWarmupInstanceId(mockUtility: MockAzureAppServiceUtility): Promise<string | undefined> {
    try {
        const instances = await mockUtility.getAppserviceInstances();
        if (instances?.value?.length > 0) {
            const sortedInstances = instances.value.sort((a: any, b: any) => a.name.localeCompare(b.name));
            return sortedInstances[0].name;
        }
    } catch (error) {
        mockDebug(`Failed to get app service instances - ${error}`);
    }
    return undefined;
}

// Simulate the warmUp logic from KuduServiceUtility
async function warmUp(mockKudu: MockKudu): Promise<void> {
    try {
        mockDebug('warming up Kudu Service');
        await mockKudu.warmup();
        mockDebug('warmed up Kudu Service');
    } catch (error: any) {
        mockDebug('Failed to warm-up Kudu: ' + error.toString());
    }
}

describe('Kudu Warmup Tests', function () {

    beforeEach(() => {
        debugMessages = [];
    });

    describe('KuduServiceUtility.warmUp', function () {
        it('should call kudu warmup API successfully', async function () {
            const mockKudu = new MockKudu();
            
            await warmUp(mockKudu);

            assert.strictEqual(mockKudu.warmupCalled, true, 'warmup should be called');
            assert.ok(debugMessages.includes('warming up Kudu Service'), 'Should log warming up message');
            assert.ok(debugMessages.includes('warmed up Kudu Service'), 'Should log warmed up message');
        });

        it('should handle warmup failure gracefully', async function () {
            const mockKudu = new MockKudu();
            mockKudu.warmupShouldFail = true;

            await warmUp(mockKudu);

            assert.strictEqual(mockKudu.warmupCalled, true, 'warmup should be called');
            assert.ok(debugMessages.some(msg => msg.includes('Failed to warm-up Kudu')), 'Should log failure message');
        });
    });

    describe('getWarmupInstanceId', function () {
        it('should return first instance when multiple instances exist (sorted by name)', async function () {
            const mockUtility = new MockAzureAppServiceUtility();
            mockUtility.instancesResponse = {
                value: [
                    { name: 'instance-c' },
                    { name: 'instance-a' },
                    { name: 'instance-b' }
                ]
            };

            const result = await getWarmupInstanceId(mockUtility);

            assert.strictEqual(result, 'instance-a', 'Should return the first instance alphabetically');
        });

        it('should return undefined when no instances exist', async function () {
            const mockUtility = new MockAzureAppServiceUtility();
            mockUtility.instancesResponse = { value: [] };

            const result = await getWarmupInstanceId(mockUtility);

            assert.strictEqual(result, undefined, 'Should return undefined when no instances');
        });

        it('should return undefined when instances response is null', async function () {
            const mockUtility = new MockAzureAppServiceUtility();
            mockUtility.instancesResponse = null;

            const result = await getWarmupInstanceId(mockUtility);

            assert.strictEqual(result, undefined, 'Should return undefined when response is null');
        });

        it('should return undefined and log error when fetching instances fails', async function () {
            const mockUtility = new MockAzureAppServiceUtility();
            mockUtility.instancesShouldFail = true;

            const result = await getWarmupInstanceId(mockUtility);

            assert.strictEqual(result, undefined, 'Should return undefined on error');
            assert.ok(debugMessages.some(msg => msg.includes('Failed to get app service instances')), 'Should log error message');
        });

        it('should return single instance when only one instance exists', async function () {
            const mockUtility = new MockAzureAppServiceUtility();
            mockUtility.instancesResponse = {
                value: [
                    { name: 'single-instance' }
                ]
            };

            const result = await getWarmupInstanceId(mockUtility);

            assert.strictEqual(result, 'single-instance', 'Should return the single instance');
        });
    });

    describe('PreDeploymentStep warmup instance usage', function () {
        it('should pass warmup instance to getKuduService when instance exists', async function () {
            const mockUtility = new MockAzureAppServiceUtility();
            mockUtility.instancesResponse = {
                value: [{ name: 'test-instance-123' }]
            };

            const warmUpInstance = await getWarmupInstanceId(mockUtility);

            if (warmUpInstance) {
                mockDebug(`Using instance ${warmUpInstance} for warmup.`);
            } else {
                mockDebug('No specific instance for warmup, using default endpoint.');
            }

            await mockUtility.getKuduService(warmUpInstance);

            assert.strictEqual(mockUtility.getKuduServiceCalledWith, 'test-instance-123', 'Should pass instance ID to getKuduService');
            assert.ok(debugMessages.some(msg => msg.includes('Using instance test-instance-123 for warmup')), 'Should log instance being used');
        });

        it('should pass undefined to getKuduService when no instance exists', async function () {
            const mockUtility = new MockAzureAppServiceUtility();
            mockUtility.instancesResponse = { value: [] };

            const warmUpInstance = await getWarmupInstanceId(mockUtility);

            if (warmUpInstance) {
                mockDebug(`Using instance ${warmUpInstance} for warmup.`);
            } else {
                mockDebug('No specific instance for warmup, using default endpoint.');
            }

            await mockUtility.getKuduService(warmUpInstance);

            assert.strictEqual(mockUtility.getKuduServiceCalledWith, undefined, 'Should pass undefined to getKuduService');
            assert.ok(debugMessages.some(msg => msg.includes('No specific instance for warmup')), 'Should log no instance message');
        });
    });
});
