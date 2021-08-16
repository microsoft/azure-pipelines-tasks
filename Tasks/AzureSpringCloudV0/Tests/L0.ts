import fs = require('fs');
import { AzureSpringCloudUnitTests } from './AzureSpringCloudUnitTests';
import { nock } from './mock_utils';
import { CreateNamedDeploymentFailsDeploymentDoesNotAlreadyExist } from './CreateNamedDeploymentFailsDeploymentDoesNotAlreadyExist';
import { CreateNamedDeploymentFailsWhenTwoDeploymentsExist } from './CreateNamedDeploymentFailsWhenTwoDeploymentsExist';
import { DeploymentFailsWithInsufficientDeployments } from './DeploymentFailsWithInsufficientDeployments';
import { DeploymentToStagingSucceeds } from './DeploymentToStagingSucceeds';
import { SetProductionUseStagingFailsWithNoStaging } from './SetProductionUseStagingFailsWithNoStaging';
import { SetProductionUseStagingSucceeds } from './SetProductionUseStagingSucceeds';
import { SetNamedDeploymentFailsWhenDeploymentDoesNotExist } from './SetNamedDeploymentFailsWhenDeploymentDoesNotExist';
import { SetProductionNamedDeploymentSucceeds } from './SetProductionNamedDeploymentSucceeds';
import { DeleteStagingDeploymentTest } from './DeleteStagingDeploymentTest';

describe('Azure Spring Cloud deployment Suite', function () {
    afterEach(() => {
        nock.cleanAll();
    });

    this.timeout(900000);

    // /*************** Unit Tests ***************/
    it('Azure Spring Cloud wrapper behaves according to expectations', AzureSpringCloudUnitTests.testDeploymentNameRetrieval);
    it('Prevents a path traversal attack in the Azure Spring Cloud Resource ID', AzureSpringCloudUnitTests.testDeploymentNameRetrieval);

    /*************** Deployment tests ************/
    it('Correctly errors out when attempting to use staging deployment and no staging deployment exists', DeploymentFailsWithInsufficientDeployments.mochaTest);
    it('Correctly errors out when attempting to create a new deployment, and two deployments already exist.', CreateNamedDeploymentFailsWhenTwoDeploymentsExist.mochaTest);
    it('Correctly errors out deploying to a named deployment with "create new" disabled, and the named deployment does not exist', CreateNamedDeploymentFailsDeploymentDoesNotAlreadyExist.mochaTest);
    it('Correctly deploys to a current staging deployment', DeploymentToStagingSucceeds.mochaTest);

    /*************** Set Production Deployment tests ************/
    it('Correctly errors out when "Use Staging Deployment" is set but no such deployment exists', SetProductionUseStagingFailsWithNoStaging.mochaTest);
    it('Deploys correctly to a staging deployment when "Use Staging Deployment is set', SetProductionUseStagingSucceeds.mochaTest);
    it('Correctly errors out when setting named deployment as production, but the deployment does not exist', SetNamedDeploymentFailsWhenDeploymentDoesNotExist.mochaTestTargetDeploymentDoesNotExist);
    it('Correctly errors out when setting named deployment as production, but the deployment is already production', SetNamedDeploymentFailsWhenDeploymentDoesNotExist.mochaTestTargetDeploymentAlreadyProduction);
    it('Correctly sets a named deployment as production', SetProductionNamedDeploymentSucceeds.mochaTest);

    /********** Delete Deployment ****************/
    it('Correctly errors out when attempting to delete the staging deployment and no such deployment exists', DeploymentFailsWithInsufficientDeployments.mochaTest);
    it('Correctly deletes the staging deployment', DeleteStagingDeploymentTest.mochaTest);
});


