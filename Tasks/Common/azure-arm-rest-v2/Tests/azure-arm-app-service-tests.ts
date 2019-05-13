import { AzureAppService } from '../azure-arm-app-service';
import { getMockEndpoint, mockAzureAppServiceTests } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import * as querystring from 'querystring';
import tl = require('azure-pipelines-task-lib/task');
var endpoint = getMockEndpoint();

mockAzureAppServiceTests();

class AzureAppServiceTests {
    public static async start() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            await appSerivce.start();
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.start() should have passed but failed');
        }

        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.start();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.start() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async stop() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        
        appSerivce.stop().catch((error) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.stop() should have passed but failed');
        });

        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.stop().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.stop() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });

        
    }

    public static async restart() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        
        appSerivce.restart().catch((error) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.restart() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.restart().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.restart() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static async swap() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        
        appSerivce.swap("MOCK_TARGET_SLOT", false).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.swap() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.swap("MOCK_TARGET_SLOT", true).then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.swap() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
        
    }

    public static async get() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.get();
            console.log('MOCK_APP_SERVICE_NAME ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.get() should have passed but failed');
        }
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.get();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.get() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async getPublishingProfileWithSecrets() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.getPublishingProfileWithSecrets();
            console.log('MOCK_APP_SERVICE_NAME PUBLISHING_PROFILE : ' + value);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingProfileWithSecrets() should have passed but failed');
        }
        
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.getPublishingProfileWithSecrets();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingProfileWithSecrets() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }      
    }

    public static async getPublishingCredentials() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.getPublishingCredentials();
            console.log('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingCredentials() should have passed but failed');
        }
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.getPublishingCredentials();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingCredentials() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async getApplicationSettings() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.getApplicationSettings();
            console.log('MOCK_APP_SERVICE_NAME APPSETTINGS ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getApplicationSettings() should have passed but failed');
        }
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.getApplicationSettings();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getApplicationSettings() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async updateApplicationSettings() {
        var appSettings = {
            id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/appsettings",
            name: "MOCK_APP_SERVICE_NAME",
            type: "Microsoft.Web/sites",
            kind: "app",
            location: "South Central US",
            properties: {
                "WEBSITE_NODE_DEFAULT_VERSION": "6.9.1",
                "MSDEPLOY_RENAME_LOCKED_FILES": "0"
            }
        };

        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.updateApplicationSettings(appSettings);
            console.log('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateApplicationSettings() should have passed but failed');
        }
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.updateApplicationSettings(appSettings);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateApplicationSettings() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async getConfiguration() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.getConfiguration();
            console.log('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getConfiguration() should have passed but failed');
        }
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.getApplicationSettings();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getConfiguration() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async updateConfiguration() {
        var appSettings = {
            id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/web",
            name: "MOCK_APP_SERVICE_NAME",
            type: "Microsoft.Web/sites",
            kind: "app",
            location: "South Central US",
            properties: {
                "alwaysOn": true
            }
        };

        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.updateConfiguration(appSettings);
            console.log('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have passed but failed');
        }
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.updateConfiguration(appSettings);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async patchConfiguration() {
        try {
            var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
            await appSerivce.patchConfiguration({'properties': {}});
            console.log('PATCH CONFIGURATION PASSED');
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.patchConfiguration() should have passed but failed');
        }

        try {
            var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
            await appSerivceSlot.patchConfiguration({'properties': {}});
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.patchConfiguration() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async getMetadata() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.getMetadata();
            console.log('MOCK_APP_SERVICE_NAME CONFIG_METADATA GET ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getMetadata() should have passed but failed');
        }
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.getMetadata();
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getMetadata() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

    public static async updateMetadata() {
        var appSettings = {
            id: "/subscriptions/MOCK_SUBSCRIPTION_ID/resourceGroups/vincaAzureRG/providers/Microsoft.Web/sites/MOCK_APP_SERVICE_NAME/config/metadata",
            name: "MOCK_APP_SERVICE_NAME",
            type: "Microsoft.Web/sites",
            kind: "app",
            location: "South Central US",
            properties: {
                "alwaysOn": true
            }
        };

        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        try {
            var value = await appSerivce.updateMetadata(appSettings);
            console.log('MOCK_APP_SERVICE_NAME CONFIG_METADATA UPDATE ID: ' + value.id);
        }
        catch(error) {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateMetadata() should have passed but failed');
        }
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        try {
            await appSerivceSlot.updateMetadata(appSettings);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateMetadata() should have failed but passed');
        }
        catch(error) {
            console.log(error);
        }
    }

}

async function RUNTESTS() {
    await AzureAppServiceTests.start();
    await AzureAppServiceTests.stop();
    await AzureAppServiceTests.restart();
    await AzureAppServiceTests.swap();
    await AzureAppServiceTests.get();
    await AzureAppServiceTests.getPublishingProfileWithSecrets();
    await AzureAppServiceTests.getPublishingCredentials();
    await AzureAppServiceTests.getApplicationSettings();
    await AzureAppServiceTests.updateApplicationSettings();
    await AzureAppServiceTests.getConfiguration();
    await AzureAppServiceTests.updateConfiguration();
    await AzureAppServiceTests.patchConfiguration();
    await AzureAppServiceTests.getMetadata();
    await AzureAppServiceTests.updateMetadata();
}

RUNTESTS();