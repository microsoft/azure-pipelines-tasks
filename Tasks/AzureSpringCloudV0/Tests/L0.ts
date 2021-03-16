import fs = require('fs');
import { mockCommonAzureAPIs } from './mock_utils';
import { SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist } from './SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist';
import { SetDeploymentFailsWithInsufficientDeployment } from './SetDeploymentFailsWithInsufficientDeployment';


describe('Azure Spring Cloud deployment Suite', function () {
    this.timeout(60000);

    before(() => {
    });

    after(() => {
    });
    

    /*************** Deployment tests ************/
    it('Correctly errors out when attempting set staging deployment as production and no staging deployment exists', SetDeploymentFailsWithInsufficientDeployment.mochaTest);
    it('Correctly errors out when attempting to create a new deployment, and two deployments already exist.', SetCreateNamedDeploymentFailsWhenTwoDeploymentsExist.mochaTest);
    // it('Correctly errors out deploying to a named deployment with "create new" disabled, and the named deployment does not exist');
    // it('Correctly deploys to a current staging deployment');
    // it('Correctly creates deploys to a new named deployment');
    

    /*************** Set Production Deployment tests ************/
    // it('Correctly errors out when "Use Staging Deployment" is set but no such deployment exists')
    // it('Deploys correctly to a staging deployment when "Use Staging Deployment is set")
    // it ('Correctly errors out when setting named deployment as production, but the deployment does not exist')
    // it ('Correctly errors out when setting named deployment as production, and the deployment is already set as production')
    // it('Correctly sets a named deployment as production')

    /********** Delete Deployment ****************/
    // it ('Correctly errors out when attempting to delete the staging deployment and no such deployment exists')
    // it ('Correctly deletes the staging deployment')
});


