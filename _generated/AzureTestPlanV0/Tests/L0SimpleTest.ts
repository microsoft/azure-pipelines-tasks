import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import { ExcludeFlags } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';
import { RunCreateModel } from 'azure-devops-node-api/interfaces/TestInterfaces';
import { getTestCaseListResponseWithManualTestPointsOnly, addTestResultsToTestRunResponse, createTestRunResponse } from './SampleApiResponse';
import { setEnvVariables } from './TestSetup';

let taskPath = path.join(__dirname, '..', 'runTestPlan.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

setEnvVariables();

tr.setInput('testPlan', '1');
tr.setInput('testConfiguration', '10');
tr.setInput('testSuite', '2');
tr.setInput('testSelector', 'manualTests');


const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

// I'll keep this part to help during writing of tests for automated flow
// tlClone.getVariable = function (variable: string) {
//     return process.env[variable];
// };

// tlClone.findMatch = function () {
//     let matchingFiles: string[] = ["n-files0.xml"];
//     return matchingFiles;
// }

tlClone.getEndpointAuthorizationParameter = function () {
    return 'ad4sldkajdsf4ksa5randomaccesstoken7lf9adsnfandfjlsdf';
}
tr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

tr.registerMock('azure-devops-node-api', {
  getPersonalAccessTokenHandler: function (token) {
      return {};
  },
  WebApi: function (url, handler) {
    return {
      getTestPlanApi: function () {
        return {
            getTestCaseList: function (project: string, planId: number, suiteId: number, testIds?: string, configurationIds?: string, witFields?: string, continuationToken?: string, returnIdentityRef?: boolean, expand?: boolean, excludeFlags?: ExcludeFlags, isRecursive?: boolean) {
              return getTestCaseListResponseWithManualTestPointsOnly;
            }
        };
      },
      getTestResultsApi: function() {
        return {
          createTestRun: function(testRun: RunCreateModel, project: string){
            return createTestRunResponse;
          },
          addTestResultsToTestRun: function(results: any, project: string, runId: number){
            return addTestResultsToTestRunResponse;
          }
        }
      }
    };
  }
})

// I'll keep this part to help during writing of tests for automated flow
// // provide answers for task mock
// let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
//   '': {
//     '': ''
//   }
// };
// tr.setAnswers(a);

tr.run();

