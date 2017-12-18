import { Kudu } from '../azure-arm-app-service-kudu';
import tl = require('vsts-task-lib');
import { getMockEndpoint, nock } from './mock_utils';
import { mockKuduServiceTests } from './mock_utils'; 

mockKuduServiceTests();

export class KuduTests { 
    public static async updateDeployment() {

        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.updateDeployment(true, 'MOCK_DEPLOYMENT_ID', {type: 'Deployment'});
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.updateDeployment() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.updateDeployment(true, 'MOCK_DEPLOYMENT_ID', {type: 'Deployment'});
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.updateDeployment() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async getContinuousJobs() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            console.log(`MOCK KUDU CONTINUOUS JOBS COUNT: ${(await kudu.getContinuousJobs()).length}`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getContinuousJobs() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.getContinuousJobs();
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getContinuousJobs() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async startContinuousWebJob() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.startContinuousWebJob('MOCK_JOB_NAME');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.startContinuousWebJob() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.startContinuousWebJob('MOCK_JOB_NAME');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.startContinuousWebJob() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async stopContinuousWebJob() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.stopContinuousWebJob('MOCK_JOB_NAME');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.stopContinuousWebJob() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.stopContinuousWebJob('MOCK_JOB_NAME');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.stopContinuousWebJob() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async installSiteExtension() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.installSiteExtension('MOCK_EXTENSION');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.installSiteExtension() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.installSiteExtension('MOCK_EXTENSION');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.installSiteExtension() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async getSiteExtensions() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            console.log(`MOCK KUDU SITE EXTENSIONS COUNT: ${(await kudu.getSiteExtensions()).length}`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getSiteExtensions() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.getSiteExtensions();
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getSiteExtensions() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async getProcess() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            console.log(`MOCK KUDU PROCESS ID: ${(await kudu.getProcess(0)).id}`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getProcess() should have passed but failed');
        }
    }

    public static async killProcess() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.killProcess(0);
            console.log('KILLED PROCESS 0');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.killProcess() should have passed but failed');
        }
    }

}


// tl.setVariable('AZURE_HTTP_USER_AGENT','TEST_AGENT');
KuduTests.updateDeployment();
KuduTests.getContinuousJobs();
KuduTests.startContinuousWebJob();
KuduTests.stopContinuousWebJob();
KuduTests.installSiteExtension();
KuduTests.getSiteExtensions();
KuduTests.getProcess();
KuduTests.killProcess();