import assert = require('assert');
import { AzureSpringCloudDeploymentProvider } from "../deploymentProvider/AzureSpringCloudDeploymentProvider"
import { TaskParameters } from "../operations/taskparameters"


export class AzureSpringCloudUnitTests {

    public static pathTraversalAttackTest = (done: Mocha.Done) => {
        const resourceIdWithPathAttack = '/subscriptions/mocksubid/resourceGroups/mockresouorcegroup/providers/Microsoft.AppPlatform/Spring/authorized-name/../unauthorized-name';
        const taskParameters: TaskParameters = {
            AzureSpringCloud: resourceIdWithPathAttack,
            AppName: 'appName',
            UseStagingDeployment: false,
            Action: 'Deploy'
        };

        const provider = new AzureSpringCloudDeploymentProvider(taskParameters);
        provider.PreDeploymentStep().then(() => {
            done(assert.fail('Attempted path traversal attack should have failed'));
        }).catch(error => {
            assert.strictEqual(error.message, `loc_mock_InvalidAzureSpringAppsResourceId ${resourceIdWithPathAttack}`);
            done();
        });
    }
}