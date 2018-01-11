import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as path from 'path';

export function KuduServiceTests() {
    it('azure-arm-app-service-kudu Kudu', (done: MochaDone) => {
        let tp = path.join(__dirname, 'azure-arm-app-service-kudu-tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        let passed: boolean = true;
        try {
            tr.run();
            assert(tr.succeeded, "azure-arm-app-service-kudu-tests should have passed but failed.");
            console.log("\tvalidating updateDeployment");
            updateDeployment(tr);
            console.log("\tvalidating getContinuousJobs");
            getContinuousJobs(tr);
            console.log("\tvalidating startContinuousWebJob");
            startContinuousWebJob(tr);
            console.log("\tvalidating stopContinuousWebJob");
            stopContinuousWebJob(tr);
            console.log("\tvalidating installSiteExtension");
            installSiteExtension(tr);
            console.log("\tvalidating getSiteExtensions");
            getSiteExtensions(tr);
            console.log("\tvalidating getProcess");
            getProcess(tr);
            console.log("\tvalidating killProcess");
            killProcess(tr);
        }
        catch(error) {
            passed = false;
            console.log(tr.stdout);
            console.log(tr.stderr);
            done(error);
        }

        if(passed) {
            done();
        }
    });
}

function updateDeployment(tr) {
    assert(tr.stdOutContained('Successfullyupdateddeploymenthistory http://MOCK_SCM_WEBSITE/api/deployments/MOCK_DEPLOYMENT_ID'),
        'Should have printed: Successfullyupdateddeploymenthistory http://MOCK_SCM_WEBSITE/api/deployments/MOCK_DEPLOYMENT_ID');

    assert(tr.stdOutContained('FailedToUpdateDeploymentHistory null (CODE: 504)'),
        'Should have printed: FailedToUpdateDeploymentHistory null (CODE: 504)');
}

function getContinuousJobs(tr) {
    assert(tr.stdOutContained('MOCK KUDU CONTINUOUS JOBS COUNT: 2'),
        'Should have printed: MOCK KUDU CONTINUOUS JOBS COUNT: 2');

    assert(tr.stdOutContained('Error: FailedToGetContinuousWebJobs null (CODE: 501)'),
        'Should have printed: Error: FailedToGetContinuousWebJobs null (CODE: 501)');
}

function startContinuousWebJob(tr) {
    assert(tr.stdOutContained('StartedWebJob MOCK_JOB_NAME'),
        'Should have printed: StartedWebJob MOCK_JOB_NAME');

    assert(tr.stdOutContained('FailedToStartContinuousWebJob MOCK_JOB_NAME null (CODE: 501)'),
        'Should have printed: FailedToStartContinuousWebJob MOCK_JOB_NAME null (CODE: 501)');
}

function stopContinuousWebJob(tr) {
    assert(tr.stdOutContained('StoppedWebJob MOCK_JOB_NAME'),
        'StoppedWebJob MOCK_JOB_NAME');

    assert(tr.stdOutContained('FailedToStopContinuousWebJob MOCK_JOB_NAME null (CODE: 501)'),
        'Should have printed: FailedToStopContinuousWebJob MOCK_JOB_NAME null (CODE: 501)');
}

function installSiteExtension(tr) {
    assert(tr.stdOutContained('SiteExtensionInstalled MOCK_EXTENSION'),
    'Should have printed: SiteExtensionInstalled MOCK_EXTENSION');

    assert(tr.stdOutContained('FailedToInstallSiteExtension MOCK_EXTENSION null (CODE: 501)'),
        'Should have printed: FailedToInstallSiteExtension MOCK_EXTENSION null (CODE: 501)');
}

function getSiteExtensions(tr) {
    assert(tr.stdOutContained('MOCK KUDU SITE EXTENSIONS COUNT: 2'),
    'Should have printed: MOCK KUDU SITE EXTENSIONS COUNT: 2');

    assert(tr.stdOutContained('FailedToGetSiteExtensions null (CODE: 501)'),
        'Should have printed: FailedToGetSiteExtensions null (CODE: 501)');
}

function getProcess(tr) {
    assert(tr.stdOutContained('MOCK KUDU PROCESS ID: 1'),
        'Should have printed: MOCK KUDU PROCESS ID: 1');
}


function killProcess(tr) {
    assert(tr.stdOutContained('KILLED PROCESS 0'),
        'Should have printed: KILLED PROCESS 0');
}

