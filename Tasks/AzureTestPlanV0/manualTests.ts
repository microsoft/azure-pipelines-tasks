import tl = require('azure-pipelines-task-lib/task');
import apim = require('azure-devops-node-api');
import { TestPoint } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';
import { PagedList } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import TestPlanInterfaces = require('azure-devops-node-api/interfaces/TestPlanInterfaces');
import VSSInterfaces = require('azure-devops-node-api/interfaces/common/VSSInterfaces');
import constants = require('./constants');
import { getTestPlanDataPoints, TestPlanData } from './testPlanData';

export function manualTestsFlow(testPlanInfo: TestPlanData) {

    console.log("To do:");
    console.log("Manual trigger flow to be implemented");

    //await getTestPoints(testPlan, testSuites, testPlanConfigId);

    console.log('Hii: ');

}


