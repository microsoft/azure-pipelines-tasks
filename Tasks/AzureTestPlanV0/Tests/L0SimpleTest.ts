import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import { Console } from 'console';
import path = require('path');
import { PagedList } from 'azure-devops-node-api/interfaces/common/VSSInterfaces';
import { ExcludeFlags, TestCase } from 'azure-devops-node-api/interfaces/TestPlanInterfaces';
import { RunCreateModel, TestCaseResult, TestRun } from 'azure-devops-node-api/interfaces/TestInterfaces';

let taskPath = path.join(__dirname, '..', 'runTestPlan.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('testSelector', 'manualTests');
tr.setInput('testPlan', '1');
tr.setInput('testConfiguration', '10');
tr.setInput('testSuite', '2');
tr.setInput('testSelector', 'manualTests');

process.env['AGENT_VERSION'] = '3.237.0';
process.env["SYSTEM_TEAMPROJECTID"] = "1";
process.env["BUILD_BUILDID"] = "1";

function mockServiceEndpoint(endpointId: any, url: any, auth: any) {
  process.env['ENDPOINT_URL_' + endpointId] = url;
  process.env['ENDPOINT_AUTH_' + endpointId] = JSON.stringify(auth);
}

mockServiceEndpoint(
  'SYSTEMVSSCONNECTION',
  'https://example.visualstudio.com/defaultcollection',
  {
      parameters: { AccessToken: 'token'},
      scheme: 'OAuth'
  }
);

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);

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


let mockPagedTestCasesObject = [
  {
    "testPlan": {
      "id": 1,
      "name": "Test Plan For Delete Functionality"
    },
    "project": {
      "id": "f9ba3132-23a9-49b2-b6b9-55a14a0fdc6f",
      "name": "Java Maven",
      "state": "unchanged",
      "visibility": 0,
      "lastUpdateTime": "0000-12-31T18:06:32.000Z"
    },
    "testSuite": {
      "id": 2,
      "name": "Test Plan For Delete Functionality"
    },
    "workItem": {
      "id": 9,
      "name": "TC1WithAssociationToDelete",
      "workItemFields": [
        {
          "Microsoft.VSTS.Common.ActivatedBy": "Aditya Shah <AdityaShah@adotpmtenant.ccsctp.net>"
        },
        {
          "Microsoft.VSTS.Common.ActivatedDate": "2024-03-14T20:32:19.27Z"
        },
        {
          "Microsoft.VSTS.TCM.AutomationStatus": "Not Automated"
        },
        {
          "System.State": "Design"
        },
        {
          "System.AssignedTo": "Aditya Shah <AdityaShah@adotpmtenant.ccsctp.net>"
        },
        {
          "Microsoft.VSTS.Common.Priority": 2
        },
        {
          "Microsoft.VSTS.Common.StateChangeDate": "2024-03-14T20:32:19.27Z"
        },
        {
          "System.WorkItemType": "Test Case"
        },
        {
          "System.Rev": 1
        }
      ]
    },
    "pointAssignments": [
      {
        "id": 5,
        "configurationName": "Windows 10",
        "tester": {
          "displayName": "Aditya Shah",
          "url": "https://vssps.codedev.ms/e/adoTpmTenant/_apis/Identities/2622cefd-ccd7-61ac-b577-4a5a723ca9a4",
          "_links": {
            "avatar": {
              "href": "https://codedev.ms/AdityaShah/_apis/GraphProfile/MemberAvatars/aad.MjYyMmNlZmQtY2NkNy03MWFjLWI1NzctNGE1YTcyM2NhOWE0"
            }
          },
          "id": "2622cefd-ccd7-61ac-b577-4a5a723ca9a4",
          "uniqueName": "AdityaShah@adotpmtenant.ccsctp.net",
          "imageUrl": "https://codedev.ms/AdityaShah/_apis/GraphProfile/MemberAvatars/aad.MjYyMmNlZmQtY2NkNy03MWFjLWI1NzctNGE1YTcyM2NhOWE0",
          "descriptor": "aad.MjYyMmNlZmQtY2NkNy03MWFjLWI1NzctNGE1YTcyM2NhOWE0"
        },
        "configurationId": 10
      }
    ],
    "links": {
      "testPoints": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7/Suites/8/TestPoint/5"
      },
      "configuration": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Configurations/1"
      },
      "_self": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7/Suites/8/TestCase"
      },
      "sourcePlan": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7"
      },
      "sourceSuite": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7/Suites/8"
      },
      "sourceProject": {
        "href": "https://codedev.ms/AdityaShah/_apis/projects/Java%20Maven"
      }
    }
  },
  {
    "testPlan": {
      "id": 1,
      "name": "Test Plan For Delete Functionality"
    },
    "project": {
      "id": "f9ba3132-23a9-49b2-b6b9-55a14a0fdc6f",
      "name": "Java Maven",
      "state": "unchanged",
      "visibility": 0,
      "lastUpdateTime": "0000-12-31T18:06:32.000Z"
    },
    "testSuite": {
      "id": 2,
      "name": "Test Plan For Delete Functionality"
    },
    "workItem": {
      "id": 10,
      "name": "TC2WithAssociationToDelete",
      "workItemFields": [
        {
          "Microsoft.VSTS.Common.ActivatedBy": "Aditya Shah <AdityaShah@adotpmtenant.ccsctp.net>"
        },
        {
          "Microsoft.VSTS.Common.ActivatedDate": "2024-03-14T20:32:32.657Z"
        },
        {
          "System.State": "Design"
        },
        {
          "System.AssignedTo": "Aditya Shah <AdityaShah@adotpmtenant.ccsctp.net>"
        },
        {
          "Microsoft.VSTS.Common.Priority": 2
        },
        {
          "Microsoft.VSTS.Common.StateChangeDate": "2024-03-14T20:32:32.657Z"
        },
        {
          "System.WorkItemType": "Test Case"
        },
        {
          "System.Rev": 3
        }
      ]
    },
    "order": 1,
    "pointAssignments": [
      {
        "id": 6,
        "configurationName": "Windows 10",
        "tester": {
          "displayName": "Aditya Shah",
          "url": "https://vssps.codedev.ms/e/adoTpmTenant/_apis/Identities/2622cefd-ccd7-61ac-b577-4a5a723ca9a4",
          "_links": {
            "avatar": {
              "href": "https://codedev.ms/AdityaShah/_apis/GraphProfile/MemberAvatars/aad.MjYyMmNlZmQtY2NkNy03MWFjLWI1NzctNGE1YTcyM2NhOWE0"
            }
          },
          "id": "2622cefd-ccd7-61ac-b577-4a5a723ca9a4",
          "uniqueName": "AdityaShah@adotpmtenant.ccsctp.net",
          "imageUrl": "https://codedev.ms/AdityaShah/_apis/GraphProfile/MemberAvatars/aad.MjYyMmNlZmQtY2NkNy03MWFjLWI1NzctNGE1YTcyM2NhOWE0",
          "descriptor": "aad.MjYyMmNlZmQtY2NkNy03MWFjLWI1NzctNGE1YTcyM2NhOWE0"
        },
        "configurationId": 10
      }
    ],
    "links": {
      "testPoints": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7/Suites/8/TestPoint/6"
      },
      "configuration": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Configurations/1"
      },
      "_self": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7/Suites/8/TestCase"
      },
      "sourcePlan": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7"
      },
      "sourceSuite": {
        "href": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/testplan/Plans/7/Suites/8"
      },
      "sourceProject": {
        "href": "https://codedev.ms/AdityaShah/_apis/projects/Java%20Maven"
      }
    }
  }
];

// let mockApi = {
//   getTestPlanApi: () => {
//     return {
//       getTestPlan: () => {
//         return mockPagedTestCasesObject;
//       },
//     };
//   },
// };

// tr.registerMock('azure-devops-node-api/webapi', mockApi);

let testRunResponse: TestRun = {
  "id": 174,
  "name": "Manual test run",
  "url": "https://codedev.ms/AdityaShah/Java%20Maven/_apis/test/Runs/174",
  "build": {
    "id": "56"
  },
  "isAutomated": false,
  "iteration": "manual",
  "owner": {
    "displayName": null,
    "id": "00000000-0000-0000-0000-000000000000"
  },
  "project": {
    "id": "f9ba3132-23a9-49b2-b6b9-55a14a0fdc6f",
    "name": "Java Maven"
  },
  "state": "Unspecified",
  "plan": {
    "id": "7"
  },
  "totalTests": 0,
  "incompleteTests": 0,
  "notApplicableTests": 0,
  "passedTests": 0,
  "unanalyzedTests": 0,
  "revision": 2,
  "webAccessUrl": "https://codedev.ms/AdityaShah/Java%20Maven/_TestManagement/Runs?runId=174&_a=runCharts"
};

let testResultResponse: TestCaseResult[] = [
  {
    "id": 100000,
    "project": {},
    "testRun": {
      "id": "174"
    },
    "priority": 0,
    "url": "",
    "lastUpdatedBy": {
      "displayName": null,
      "id": null
    }
  }
];

tr.registerMock('azure-devops-node-api', {
  getPersonalAccessTokenHandler: function (token) {
      return {};
  },
  WebApi: function (url, handler) {
    return {
      getTestPlanApi: function () {
        return {
            getTestCaseList: function (project: string, planId: number, suiteId: number, testIds?: string, configurationIds?: string, witFields?: string, continuationToken?: string, returnIdentityRef?: boolean, expand?: boolean, excludeFlags?: ExcludeFlags, isRecursive?: boolean) {
              return mockPagedTestCasesObject;
            }
        };
      },
      getTestResultsApi: function() {
        return {
          createTestRun: function(testRun: RunCreateModel, project: string){
            return testRunResponse;
          },
          addTestResultsToTestRun: function(results: any, project: string, runId: number){
            return testResultResponse;
          }
        }
      }
    };
  }
})
// process.env['HOME'] = '/users/test';

// // provide answers for task mock
// let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
//   '': {
//     '': ''
//   }
// };
// tr.setAnswers(a);

tr.run();

