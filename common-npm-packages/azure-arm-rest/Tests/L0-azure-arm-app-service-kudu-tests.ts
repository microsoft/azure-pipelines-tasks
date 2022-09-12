import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
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
            console.log("\tvalidating getAllSiteExtensions");
            getAllSiteExtensions(tr);
            console.log("\tvalidating getProcess");
            getProcess(tr);
            console.log("\tvalidating killProcess");
            killProcess(tr);
            console.log("\tvalidating getAppSettings");
            getAppSettings(tr);
            console.log("\tvalidating listDir");
            listDir(tr);
            console.log("\tvalidating getFileContent");
            getFileContent(tr);
            console.log("\tvalidating uploadFile");
            uploadFile(tr);
            console.log("\tvalidating createPath");
            createPath(tr);
            console.log("\tvalidating runCommand");
            runCommand(tr);
            console.log("\tvalidating extractZIP");
            extractZIP(tr);
            console.log("\tvalidating zipDeploy");
            zipDeploy(tr);
            console.log("\tvalidating deleteFile");
            deleteFile(tr);
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

    assert(tr.stdOutContained('Failedtoupdatedeploymenthistory null (CODE: 501)'),
        'Should have printed: Failedtoupdatedeploymenthistory null (CODE: 501)');
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

function getAllSiteExtensions(tr) {
    assert(tr.stdOutContained('MOCK KUDU SITE EXTENSIONS COUNT: 3'),
    'Should have printed: MOCK KUDU SITE EXTENSIONS COUNT: 3');

    assert(tr.stdOutContained('FailedToGetAllSiteExtensions null (CODE: 501)'),
        'Should have printed: FailedToGetAllSiteExtensions null (CODE: 501)');
}

function getProcess(tr) {
    assert(tr.stdOutContained('MOCK KUDU PROCESS ID: 1'),
        'Should have printed: MOCK KUDU PROCESS ID: 1');
}

function killProcess(tr) {
    assert(tr.stdOutContained('KILLED PROCESS 0'),
        'Should have printed: KILLED PROCESS 0');
}

function getAppSettings(tr) {
    assert(tr.stdOutContained('KUDU APP SETTINGS {"MSDEPLOY_RENAME_LOCKED_FILES":"1","ScmType":"VSTSRM"}'),
    'Should have printed: KUDU APP SETTINGS {"MSDEPLOY_RENAME_LOCKED_FILES":"1","ScmType":"VSTSRM"}');

    assert(tr.stdOutContained('FailedToFetchKuduAppSettings null (CODE: 501)'),
        'Should have printed: FailedToFetchKuduAppSettings null (CODE: 501)');
}

function listDir(tr) {
    assert(tr.stdOutContained('KUDU LIST DIR [{"name":"web.config"},{"name":"content","size":777}]'),
    'Should have printed: KUDU LIST DIR [{"name":"web.config"},{"name":"content","size":777}]');

    assert(tr.stdOutContained('FailedToListPath site/wwwroot null (CODE: 501)'),
        'Should have printed: FailedToListPath site/wwwroot null (CODE: 501)');
}

function getFileContent(tr) {
    assert(tr.stdOutContained('KUDU FILE CONTENT HELLO.TXT FILE CONTENT'),
    'Should have printed: KUDU FILE CONTENT HELLO.TXT FILE CONTENT');

    assert(tr.stdOutContained('KUDU FILE CONTENT 404 - PASSED'),
        'Should have printed: KUDU FILE CONTENT 404 - PASSED');

    assert(tr.stdOutContained('FailedToGetFileContent site/wwwroot web.config null (CODE: 501)'),
        'Should have printed: FailedToGetFileContent site/wwwroot web.config null (CODE: 501)');
}

function uploadFile(tr) {
    assert(tr.stdOutContained('KUDU FILE UPLOAD HELLO.TXT PASSED'),
    'Should have printed: KUDU FILE UPLOAD HELLO.TXT PASSED');

    assert(tr.stdOutContained('FailedToUploadFile site/wwwroot web.config null (CODE: 501)'),
        'Should have printed: FailedToUploadFile site/wwwroot web.config null (CODE: 501)');
}

function createPath(tr) {
    assert(tr.stdOutContained('KUDU CREATE PATH SITE/WWWROOT PASSED'),
    'Should have printed: KUDU CREATE PATH SITE/WWWROOT PASSED');

    assert(tr.stdOutContained('FailedToCreatePath site/wwwroot null (CODE: 501)'),
        'Should have printed: FailedToCreatePath site/wwwroot null (CODE: 501)');
}

function runCommand(tr) {

    assert(tr.stdOutContained('Executing Script on Kudu. Command: echo hello'),
        'Should have printed: Executing Script on Kudu. Command: echo hello');

    assert(tr.stdOutContained('KUDU RUN COMMAND PASSED'),
        'Should have printed: KUDU RUN COMMAND PASSED');

    assert(tr.stdOutContained('Executing Script on Kudu. Command: exit /b 1'),
        'Should have printed: Executing Script on Kudu. Command: exit /b 1');
}

function extractZIP(tr) {
    assert(tr.stdOutContained('KUDU ZIP API PASSED'),
    'Should have printed: KUDU ZIP API PASSED');

    assert(tr.stdOutContained('Failedtodeploywebapppackageusingkuduservice null (CODE: 501)'),
        'Should have printed: Failedtodeploywebapppackageusingkuduservice null (CODE: 501)');
}

function deleteFile(tr) {
    assert(tr.stdOutContained('KUDU DELETE FILE PASSED'),
        'Should have printed: KUDU DELETE FILE PASSED');

    assert(tr.stdOutContained('FailedToDeleteFile site/wwwroot web.config null (CODE: 501)'),
        'Should have printed: Error: FailedToDeleteFile site/wwwroot web.config null (CODE: 501)');
}

function zipDeploy(tr) {
    assert(tr.stdOutContained('KUDU ZIP DEPLOY PASSED. ID: ZIP_DEPLOY_PASSED_ID. STATUS: 4.'),
    'Should have printed: KUDU ZIP DEPLOY PASSED. ID: ZIP_DEPLOY_PASSED_ID. STATUS: 4.');

    assert(tr.stdOutContained('KUDU ZIP DEPLOY FAILED. ID: ZIP_DEPLOY_FAILED_ID. STATUS: 3.'),
        'Should have printed: KUDU ZIP DEPLOY FAILED. ID: ZIP_DEPLOY_FAILED_ID. STATUS: 3.');
}