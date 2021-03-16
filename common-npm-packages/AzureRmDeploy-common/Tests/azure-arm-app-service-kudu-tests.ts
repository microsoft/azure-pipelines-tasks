import { Kudu } from '../azure-arm-rest/azure-arm-app-service-kudu';
import tl = require('azure-pipelines-task-lib');
import { getMockEndpoint, nock } from './mock_utils';
import { mockKuduServiceTests } from './mock_utils'; 
import path = require('path');

mockKuduServiceTests();

export class KuduTests { 
    
    public static async updateDeployment() {

        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.updateDeployment({id: 'MOCK_DEPLOYMENT_ID', type: 'Deployment'});
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.updateDeployment() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.updateDeployment({id: 'MOCK_DEPLOYMENT_ID', type: 'Deployment'});
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

    public static async getAllSiteExtensions() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            console.log(`MOCK KUDU SITE EXTENSIONS COUNT: ${(await kudu.getAllSiteExtensions()).length}`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getAllSiteExtensions() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.getAllSiteExtensions();
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getAllSiteExtensions() should have failed but passed');
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

    public static async getAppSettings() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            var appSettings = await kudu.getAppSettings();
            console.log(`KUDU APP SETTINGS ${JSON.stringify(appSettings)}`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getAppSettings() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.getAppSettings();
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getAppSettings() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async listDir() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            var listDir = await kudu.listDir('/site/wwwroot');
            console.log(`KUDU LIST DIR ${JSON.stringify(listDir)}`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.listDir() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.listDir('/site/wwwroot');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.listDir() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async getFileContent() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            var fileContent: string = await kudu.getFileContent('/site/wwwroot', 'hello.txt');
            console.log(`KUDU FILE CONTENT ${fileContent}`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getFileContent() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            var fileContent: string = await kudu.getFileContent('/site/wwwroot', '404.txt');
            if(fileContent == null) {
                console.log('KUDU FILE CONTENT 404 - PASSED');
            }
            else {
                console.log('KUDU FILE CONTENT 404 - FAILED');
            }  
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getFileContent() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.getFileContent('/site/wwwroot', 'web.config');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.getFileContent() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async uploadFile() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.uploadFile('/site/wwwroot', 'hello.txt', path.join(__dirname, 'package.json'));
            console.log('KUDU FILE UPLOAD HELLO.TXT PASSED');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.uploadFile() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.uploadFile('/site/wwwroot', 'web.config', path.join(__dirname, 'package.json'));
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.uploadFile() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async createPath() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.createPath('/site/wwwroot');
            console.log('KUDU CREATE PATH SITE/WWWROOT PASSED');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.createPath() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.createPath('/site/wwwroot');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.createPath() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async runCommand() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.runCommand('site\\wwwroot', 'echo hello');
            console.log('KUDU RUN COMMAND PASSED');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.runCommand() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.runCommand('site\\wwwroot', 'exit /b 1');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.runCommand() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async extractZIP() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            var listDir = await kudu.extractZIP(path.join(__dirname, 'package.json'), '/site/wwwroot');
            console.log('KUDU ZIP API PASSED');
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.extractZIP() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.extractZIP(path.join(__dirname, 'package.json'), '/site/wwwroot');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.extractZIP() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async zipDeploy() {
        try {
            let kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            let deploymentDetails = await kudu.zipDeploy(path.join(__dirname, 'package.json'), ['deployer=VSTS_ZIP_DEPLOY']);
            console.log(`KUDU ZIP DEPLOY PASSED. ID: ${deploymentDetails.id}. STATUS: ${deploymentDetails.status}.`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.zipDeploy() should have passed but failed');
        }

        try {
            let kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            let deploymentDetails = await kudu.zipDeploy(path.join(__dirname, 'package.json'), ['deployer=VSTS_ZIP_DEPLOY']);
            console.log(`KUDU ZIP DEPLOY FAILED. ID: ${deploymentDetails.id}. STATUS: ${deploymentDetails.status}.`);
        }
        catch(error) {
            tl.error(error);
        }
    }

    public static async deleteFile() {
        try {
            var kudu = new Kudu('http://MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.deleteFile('/site/wwwroot', 'hello.txt');
            console.log(`KUDU DELETE FILE PASSED`);
        }
        catch(error) {
            tl.error(error);
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.deleteFile() should have passed but failed');
        }

        try {
            var kudu = new Kudu('http://FAIL_MOCK_SCM_WEBSITE', 'MOCK_SCM_USERNAME', 'MOCK_SCM_PASSWORD');
            await kudu.deleteFile('/site/wwwroot', 'web.config');
            tl.setResult(tl.TaskResult.Failed, 'KuduTests.deleteFile() should have failed but passed');
        }
        catch(error) {
            tl.error(error);
        }
    }

}

async function RUNTESTS() {
    await KuduTests.updateDeployment();
    await KuduTests.getContinuousJobs();
    await KuduTests.startContinuousWebJob();
    await KuduTests.stopContinuousWebJob();
    await KuduTests.installSiteExtension();
    await KuduTests.getSiteExtensions();
    await KuduTests.getAllSiteExtensions();
    await KuduTests.getProcess();
    await KuduTests.killProcess();
    await KuduTests.getAppSettings();
    await KuduTests.listDir();
    await KuduTests.getFileContent();
    await KuduTests.uploadFile();
    await KuduTests.createPath();
    await KuduTests.runCommand();
    await KuduTests.extractZIP();
    await KuduTests.deleteFile();
    await KuduTests.zipDeploy();
}

RUNTESTS();