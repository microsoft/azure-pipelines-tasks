import * as tl from 'azure-pipelines-task-lib';
import { TestPlanData, personalAccessTokenRegexp } from '../testPlanData';
import { RunCreateModel } from 'azure-devops-node-api/interfaces/TestInterfaces';
import * as apim from 'azure-devops-node-api';


export async function getVstsWepApi(): Promise<apim.WebApi> {
    let url = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
    let token = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);

    let auth = (token.length == 52 || personalAccessTokenRegexp.test(token)) ? apim.getPersonalAccessTokenHandler(token) : apim.getBearerHandler(token);
    let vsts: apim.WebApi = new apim.WebApi(url, auth);
    return vsts;
}

export function prepareRunModel(testPlanInfo: TestPlanData): RunCreateModel {

    // some create run params may change on based of requirement
    let buildId = tl.getVariable('Build.BuildId');
    let testPointIds: number[] = testPlanInfo.listOfManualTestPoints.map(testPoint => parseInt(testPoint.testPoint.id));
    let testPlanId = testPlanInfo.testPlanId;
    let testConfigurationId = testPlanInfo.testConfigurationId;

    const currentUtcTime = new Date().toUTCString();
    console.log("date:...", currentUtcTime);

    const testRunRequestBody: RunCreateModel = {
        automated: false,
        name: 'Manual test run',
        plan: { id: testPlanId.toString() },
        configurationIds: [testConfigurationId],
        pointIds: testPointIds,
        build: { id: buildId },
        iteration: "manual"
    };

    return testRunRequestBody;
}

export async function getTestResultApiClient() {

    let vsts = await getVstsWepApi();
    let testResultsApi = await vsts.getTestResultsApi();

    console.log("Test result api client created");
    return testResultsApi;
}

