import { Kudu } from '../azure-arm-app-service-kudu';
import tl = require('vsts-task-lib');
import { getMockEndpoint, nock } from './mock_utils';
// process.env["AZURE_HTTP_USER_AGENT"] = "TEST_AGENT";
export class KuduTests {

    public static mockUpdateDeployment() {
        nock('http://MOCK_SCM_WEBSITE').
        put('/api/deployments/MOCK_DEPLOYMENT_ID').reply(200, {
            type: 'Deployment'
        });

        
    }

    public static async updateDeployment() {
        KuduTests.mockUpdateDeployment();
        var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
        kudu.updateDeployment(true, 'MOCK_DEPLOYMENT_ID', {type: 'Deployment'}).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'Kudu.updateDeployment() should have passed but failed');
        });
    }
}


// tl.setVariable('AZURE_HTTP_USER_AGENT','TEST_AGENT');
KuduTests.updateDeployment();