import { AzureAppService } from '../azure-arm-app-service';
import { getMockEndpoint, mockAzureAppServiceTests } from './mock_utils';
import { AzureEndpoint } from '../azureModels';
import * as querystring from 'querystring';
import tl = require('vsts-task-lib');
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
        appSerivce.get().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.get() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.get().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.get() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
        
    }

    /*
    public static async monitorAppState() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.monitorAppState("Running")
        .catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.monitorAppState() should have passed but failed');
        });
    }
    */
    public static async getPublishingProfileWithSecrets() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getPublishingProfileWithSecrets().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME PUBLISHING_PROFILE : ' + value);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingProfileWithSecrets() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getPublishingProfileWithSecrets().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingProfileWithSecrets() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });        
    }

    /*
    public static async getWebDeployPublishingProfile() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getWebDeployPublishingProfile().then((value) => {
            console.log('WEB DEPLOY PUBLISHING PROFILE: ' + value.profileName);
        }).catch((error) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getWebDeployPublishingProfile() should have passed but failed');
            console.log(error);
        });        
    }

    */
    public static async getPublishingCredentials() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getPublishingCredentials().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingCredentials() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getPublishingCredentials().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getPublishingCredentials() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static async getApplicationSettings() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getApplicationSettings().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME APPSETTINGS ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getApplicationSettings() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getApplicationSettings().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getApplicationSettings() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
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
        appSerivce.updateApplicationSettings(appSettings).then((value) => {
            console.log('MOCK_APP_SERVICE_NAME PUBLISHINGCREDENTIALS ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateApplicationSettings() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.updateApplicationSettings(appSettings).then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateApplicationSettings() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    public static async getConfiguration() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getConfiguration().then((value) => {
            console.log('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getConfiguration() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.getApplicationSettings().then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.getConfiguration() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
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
        appSerivce.updateConfiguration(appSettings).then((value) => {
            console.log('MOCK_APP_SERVICE_NAME CONFIG_WEB ID: ' + value.id);
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have passed but failed');
        });
        
        var appSerivceSlot: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME", "MOCK_SLOT_NAME");
        appSerivceSlot.updateConfiguration(appSettings).then((value) => {
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have failed but passed');
        }).catch((error) => {
            console.log(error);
        });
    }

    /*
    public static async getKuduService() {
        var appSerivce: AzureAppService = new AzureAppService(endpoint, "MOCK_RESOURCE_GROUP_NAME", "MOCK_APP_SERVICE_NAME");
        appSerivce.getKuduService().then((value) => {
            console.log('KUDU SERVICE FROM APP SERVICE');
        }).catch((error) => {
            console.log(error);
            tl.setResult(tl.TaskResult.Failed, 'AzureAppServiceTests.updateConfiguration() should have passed but failed');
        });
    }
    */
}

AzureAppServiceTests.start();
AzureAppServiceTests.stop();
AzureAppServiceTests.restart();
AzureAppServiceTests.swap();
AzureAppServiceTests.get();
// AzureAppServiceTests.monitorAppState();
AzureAppServiceTests.getPublishingProfileWithSecrets();
// AzureAppServiceTests.getWebDeployPublishingProfile();
AzureAppServiceTests.getPublishingCredentials();
AzureAppServiceTests.getApplicationSettings();
AzureAppServiceTests.updateApplicationSettings();
AzureAppServiceTests.getConfiguration();
AzureAppServiceTests.updateConfiguration();
// AzureAppServiceTests.getKuduService();
