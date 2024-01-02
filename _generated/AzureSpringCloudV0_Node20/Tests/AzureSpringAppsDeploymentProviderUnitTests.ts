import assert = require('assert');
import { AzureSpringAppsDeploymentProvider } from "../deploymentProvider/AzureSpringAppsDeploymentProvider"
import { TaskParameters } from "../operations/taskparameters"


export class AzureSpringAppsUnitTests {

    public static pathTraversalAttackTest = (done: Mocha.Done) => {
        const resourceIdWithPathAttack = '/subscriptions/mocksubid/resourceGroups/mockresouorcegroup/providers/Microsoft.AppPlatform/Spring/authorized-name/../unauthorized-name';
        const taskParameters: TaskParameters = {
            AzureSpringApps: resourceIdWithPathAttack,
            AppName: 'appName',
            UseStagingDeployment: false,
            Action: 'Deploy'
        };

        const provider = new AzureSpringAppsDeploymentProvider(taskParameters);
        provider.PreDeploymentStep().then(() => {
            done(assert.fail('Attempted path traversal attack should have failed'));
        }).catch(error => {
            assert.strictEqual(error.message, `loc_mock_InvalidAzureSpringAppsResourceId ${resourceIdWithPathAttack}`);
            done();
        });
    }
}