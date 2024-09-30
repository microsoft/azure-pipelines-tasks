import { getMockEndpoint, nock, mockAzureAksServiceTests } from './mock_utils';
import tl = require('azure-pipelines-task-lib');
import { AzureAksService } from '../azure-arm-aks-service';

var endpoint = getMockEndpoint();

// Mock all calls for Azure AKS Service
mockAzureAksServiceTests();

export class AksServiceTests {
    public static async credentialsByClusterAdmin() {
        let aksService: AzureAksService = new AzureAksService(endpoint);
        try {
            let result = await aksService.getClusterCredential("MOCK_RESOURCE_GROUP_NAME", "MOCK_CLUSTER", true);
            console.log(`Aks Cluster Credential Found: ${result.name}`);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AksServiceTests.credentialsByClusterAdmin() should have passed but failed');
        }
    }

    public static async credentialsByClusterUser() {
        let aksService: AzureAksService = new AzureAksService(endpoint);
        try {
            let result = await aksService.getClusterCredential("MOCK_RESOURCE_GROUP_NAME", "MOCK_CLUSTER", false);
            console.log(`Aks Cluster Credential Found: ${result.name}`);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AksServiceTests.credentialsByClusterUser() should have passed but failed');
        }
    }

    public static async credentialsByCustomClusterUser() {
        let aksService: AzureAksService = new AzureAksService(endpoint);
        try {
            let result = await aksService.getClusterCredential("MOCK_RESOURCE_GROUP_NAME", "MOCK_CLUSTER", false, 'customUser');
            console.log(`Aks Cluster Credential Found: ${result.name}`);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AksServiceTests.credentialsByCustomClusterUser() should have passed but failed');
        }
    }
}

async function RUNTESTS() {
    await AksServiceTests.credentialsByClusterAdmin();
    await AksServiceTests.credentialsByClusterUser();
    await AksServiceTests.credentialsByCustomClusterUser();
}

RUNTESTS();