import { TestCaseResult, TestRun } from "azure-devops-node-api/interfaces/TestInterfaces";

export const getTestCaseListResponseWithManualTestPointsOnly = [
    {
        "testPlan": {
            "id": 7,
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
            "id": 8,
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
                "configurationId": 1
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
            "id": 7,
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
            "id": 8,
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
                },
                {
                    "Microsoft.VSTS.TCM.AutomationStatus": "Not Automated"
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
                "configurationId": 1
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

export const createTestRunResponse: TestRun = {
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

export const addTestResultsToTestRunResponse: TestCaseResult[] = [
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
    },
    {
        "id": 100001,
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

export const oAuthToken = {
    parameters: { AccessToken: 'token'},
    scheme: 'OAuth'
}
