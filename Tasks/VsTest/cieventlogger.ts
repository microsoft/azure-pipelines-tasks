import * as tl from 'vsts-task-lib/task';
import { WebApi } from 'vso-node-api/WebApi';
import { getBearerHandler } from 'vso-node-api/WebApi';
import { ICustomerIntelligenceApi as ciApi } from 'vso-node-api/CustomerIntelligenceApi';
import { CustomerIntelligenceEvent as ciEvent } from 'vso-node-api/interfaces/CustomerIntelligenceInterfaces';

const area: string = 'TestExecutionTask';
const feature: string = 'TaskExecution';

const collectionUri = tl.getVariable('System.TeamFoundationCollectionUri');
const token = tl.getEndpointAuthorization('SystemVssConnection', true).parameters['AccessToken'];
const webapi: WebApi = new WebApi(collectionUri, getBearerHandler(token));
const ci: ciApi = webapi.getCustomerIntelligenceApi();

function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid'),
        collectionuri: tl.getVariable('System.TeamFoundationCollectionUri')
    };
}

export function publishEvent(properties: { [key: string]: any }): Promise<void> {
    try {
        const event: ciEvent = {
            area: area,
            feature: feature,
            properties: Object.assign(getDefaultProps(), properties)
        };

        return webapi.getCustomerIntelligenceApi().publishEvents([event]);
    } catch (err) {
        //ignore silently
        return Promise.resolve();
    }
}

