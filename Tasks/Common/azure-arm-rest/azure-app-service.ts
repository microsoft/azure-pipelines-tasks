import { setTimeout } from 'timers';
import msRestAzure = require('./azure-arm-common');
import webClient = require('./webClient');
import azureServiceClient = require('./AzureServiceClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');
import * as querystring from 'querystring';
var parseString = require('xml2js').parseString;
import {
    AzureAppServiceConfigurationDetails,
    AzureAppServicePublishingProfile,
    AzureEndpoint,
} from './azureModels';

export class AzureAppService extends azureServiceClient.ServiceClient {
    private _appServiceName: string;
    private _resourceGroupName: string;
    private _slotName: string;
    private _appType: string;
    private _endpoint: AzureEndpoint;
    private _appDetails: AzureAppServiceConfigurationDetails;
    private _publishingProfile: AzureAppServicePublishingProfile;

    constructor(endpoint: AzureEndpoint, name: string, resourceGroup?: string, slot?: string, appType?: string) {
        var credentials = new msRestAzure.ApplicationTokenCredentials(endpoint.servicePrincipalClientID, endpoint.tenantID, endpoint.servicePrincipalKey, 
            endpoint.url, endpoint.environmentAuthorityUrl, endpoint.activeDirectoryResourceID, endpoint.environment.toLowerCase() == 'azurestack');
        super(credentials, endpoint.subscriptionID);
        this._appServiceName = name;
        this._resourceGroupName = resourceGroup;
        this._slotName = (slot && slot.toLowerCase() == 'production') ? null : slot;
    }

    public async getResourceGroupName(): Promise<string> {
        var dataDeferred = Q.defer<string>();
        if(!!this._resourceGroupName) {
            console.log("getResourceGroupName in cache");
            dataDeferred.resolve(this._resourceGroupName);
        }
        else {
            console.log('Get RG name from Resource ID')
            this.getResourceID().then((resourceID) => {
                var appServiceResourceID = resourceID[0];
                this._resourceGroupName = appServiceResourceID.id.split('/')[4];
                dataDeferred.resolve(this._resourceGroupName);
            }, (error) => {
                dataDeferred.reject('Unable to retrieve Resource group name. Error: ' + error.toString());
            });
        }
        
        return dataDeferred.promise;
    }

    public async getConfigurationDetails(configurationType: string): Promise<AzureAppServiceConfigurationDetails> {
        let dataDeferred = Q.defer<AzureAppServiceConfigurationDetails>();
        configurationType = configurationType.toLowerCase();
        var configurationSettings = AzureAppServiceConfigurations[configurationType];
        if(!configurationSettings) {
            throw Error("Invalid config type");
        }
        var resourceGroupName: string = await this.getResourceGroupName();
        var slotUrl: string = !!this._slotName ? `/slots/${this._slotName}` : '';
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = AzureAppServiceConfigurations[configurationType].GET.method;
        httpRequest.uri = this.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{AppServiceName}/{slotUrl}/{ConfigSubUrl}', {
            '{ResourceGroupName}': resourceGroupName,
            '{AppServiceName}': this._appServiceName,
            '{slotUrl}': slotUrl,
            '{ConfigSubUrl}': AzureAppServiceConfigurations[configurationType].GET.subUrl
        }, null, '2016-08-01');
        this.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        })
        return dataDeferred.promise;
    }

    public async updateConfigurationDetails(configurationType: string, configDetails: AzureAppServiceConfigurationDetails): Promise<any> {
        let dataDeferred = Q.defer<AzureAppServiceConfigurationDetails>();
        configurationType = configurationType.toLowerCase();
        var configurationSettings = AzureAppServiceConfigurations[configurationType];
        if(!configurationSettings || !configurationSettings.UPDATE) {
            throw Error("Invalid config type");
        }
        var resourceGroupName: string = await this.getResourceGroupName();
        var slotUrl: string = !!this._slotName ? `/slots/${this._slotName}` : '';
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = configurationSettings.UPDATE.method;
        httpRequest.uri = this.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{AppServiceName}/{slotUrl}/{ConfigSubUrl}', {
            '{ResourceGroupName}': resourceGroupName,
            '{AppServiceName}': this._appServiceName,
            '{slotUrl}': slotUrl,
            '{ConfigSubUrl}': AzureAppServiceConfigurations[configurationType].UPDATE.subUrl
        }, null, '2016-08-01');
        httpRequest.body = JSON.stringify(configDetails);
        this.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body as AzureAppServiceConfigurationDetails);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        })
        return dataDeferred.promise;
    }

    /**
     * Get publishing profile of the app with secrets. This constains only MSDeploy credentials.
     * 
     * https://docs.microsoft.com/en-us/rest/api/appservice/webapps/listpublishingprofilexmlwithsecrets
     */
    public async getPublishingProfile(): Promise<AzureAppServicePublishingProfile> {
        let dataDeferred = Q.defer<AzureAppServicePublishingProfile>();
        if(!!this._publishingProfile) {
            dataDeferred.resolve(this._publishingProfile);
            return dataDeferred.promise;
        }

        var resourceGroupName: string = await this.getResourceGroupName();
        var slotUrl: string = !!this._slotName ? `/slots/${this._slotName}` : '';
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this.getRequestUri('//subscriptions/{subscriptionId}/resourceGroups/{ResourceGroupName}/providers/Microsoft.Web/sites/{AppServiceName}/{slotUrl}/publishxml',
            {
                '{ResourceGroupName}': resourceGroupName,
                '{AppServiceName}': this._appServiceName,
                '{slotUrl}': slotUrl
            }, null, '2016-08-01');
        
        this.beginRequest(httpRequest).then((response) => {
            if(response.statusCode == 200) {
                var publihingProfile = response.body;
                parseString(publihingProfile, (error, result) => {
                    for (var index in result.publishData.publishProfile) {
                        // Currently, we need Publishing profile - MSDeploy
                        if (result.publishData.publishProfile[index].$.publishMethod === "MSDeploy") {
                            dataDeferred.resolve(result.publishData.publishProfile[index].$ as AzureAppServicePublishingProfile);
                        }
                    }
                    dataDeferred.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
                });
            }
            else {
                dataDeferred.reject('Failed to fetch PP : ' + JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });

        return dataDeferred.promise;
    }

    /**
     * Get the details of the web app
     * @param force if false, retrieves the content from cache
     * {@link https://docs.microsoft.com/en-us/rest/api/appservice/WebApps/Get
     */
    public async getAppDetails(force?: boolean) {
        var dataDeferred = Q.defer<any>();
        if(this._appDetails && !force) {
            console.log("getAppDetails in cache");
            dataDeferred.resolve(this._appDetails);
        }
        else {
            this.getConfigurationDetails("app_details").then((configSettings: AzureAppServiceConfigurationDetails) => {
                this._appDetails = configSettings;
                dataDeferred.resolve(configSettings as AzureAppServiceConfigurationDetails);
            }, (error) => {
                dataDeferred.reject(error);
            })
        }

        return dataDeferred.promise;
    }

    /**
     * Get the physical path mapping for virtual application path (including root)
     * @param virtualApplicationPath virtual application path
     */
    public async getPhysicalPath(virtualApplicationPath: string) {
        var dataDeferred = Q.defer<any>();
        var physicalPath = 'site/wwwroot';
        this.getConfigurationDetails(AzureAppServiceConfigurations["web"].name).then((configurationDetails) => {
            if(configurationDetails.properties && configurationDetails.properties["virtualApplications"]) {
                for(var virtualApplication of configurationDetails.properties["virtualApplications"]) {
                    if(virtualApplication.virtualPath.toLowerCase() == virtualApplicationPath.toLowerCase()) {
                        dataDeferred.resolve(virtualApplication.physicalPath);
                    }
                }
                dataDeferred.reject('No virtual application da');
            }
            else {
                dataDeferred.resolve(physicalPath);
            }

        }, (error) => {
            dataDeferred.reject(error);
        });

        return dataDeferred.promise;
    }

    /**
     * Ping site to warm-up the site
     * 
     * @param timeOut timeout in seconds
     */
    public async pingApplicationUrl(timeOut?: number) {
        timeOut = (timeOut == void 0) ? 3000 : timeOut;
        var dataDeferred = Q.defer<any>();
        this.getPublishingProfile().then((publishingProfile) => {
            var httpRequest = new webClient.WebRequest();
            httpRequest.method = 'GET';
            httpRequest.uri = publishingProfile.destinationAppUrl;
            this.beginRequest(httpRequest).then((response) => {
                setTimeout(()=> {
                    dataDeferred.resolve(response);
                }, timeOut);
            }, (error) => {
                dataDeferred.resolve(error);
            })
        }, (error) => {
            dataDeferred.reject(error);
        })
        return dataDeferred.promise;
    }

    public async patchConfigurationDetails(configurationType: string, properties: {[key: string]: any}) {
        var configDetails = await this.getConfigurationDetails(configurationType);
        for(var key in properties) {
            configDetails.properties[key] = properties[key];
        }

        await this.updateConfigurationDetails(configurationType, configDetails);
    }

    // Move to azure-arm-common - Azure Monitor tasks
    private async getResourceID() {
        var dataDeferred = Q.defer<any>();
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this.getRequestUri('//subscriptions/{subscriptionId}/resources', null,
            [`$filter=resourceType EQ \'Microsoft.Web/Sites\' AND name EQ \'${this._appServiceName}\'`], '2016-07-01');

        var webAppResourceIdList = [];
        this.beginRequest(httpRequest).then((resourceIDRequestResponse) => {
            if(resourceIDRequestResponse.statusCode == 200) {
                webAppResourceIdList = webAppResourceIdList.concat(resourceIDRequestResponse.body.value);
                if(resourceIDRequestResponse.body.nextLink) {
                    this.accumulateResultFromPagedResult(resourceIDRequestResponse.body.nextLink).then((value: azureServiceClient.ApiResult) => {
                        if(value.error) {
                            dataDeferred.reject(value.error);
                        }
                        webAppResourceIdList = webAppResourceIdList.concat(value.result);
                        dataDeferred.resolve(webAppResourceIdList);
                    });
                }
                else {
                    dataDeferred.resolve(webAppResourceIdList);
                }
            }
            else {
                dataDeferred.reject(tl.loc('UnabletoretrieveWebAppID', resourceIDRequestResponse.statusCode, resourceIDRequestResponse.statusMessage));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });

        return dataDeferred.promise;
    }
}

export const AzureAppServiceConfigurations = {
    app_details: {
        name: "app_details",
        GET: {
            method: "GET",
            subUrl: "/"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "/"
        }
    },
    appsettings : {
        name: "appsettings",
        GET: {
            method: "POST",
            subUrl: "config/appsettings/list"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "config/appsettings"
        }
    },
    authsettings: {
        name: "authsettings",
        GET: {
            method: "POST",
            subUrl: "config/authsettings/list"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "config/authsettings"
        }
    },
    connectionstrings: {
        name: "connectionstrings",
        GET: {
            method: "POST",
            subUrl: "config/connectionstrings/list"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "config/connectionstrings"
        }
    },
    logs: {
        name: "connectionstrings",
        GET: {
            method: "GET",
            subUrl: "config/logs"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "config/logs"
        }
    },
    metadata: {
        name: "metadata",
        GET: {
            method: "POST",
            subUrl: "config/metadata/list"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "config/metadata"
        }
    },
    publishingcredentials: {
        name: "metadata",
        GET: {
            method: "POST",
            subUrl: "config/publishingcredentials/list"
        }
    },
    pushsettings: {
        name: "pushsettings",
        GET: {
            method: "POST",
            subUrl: "config/pushsettings/list"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "config/pushsettings"
        }
    },
    slotconfignames: {
        name: "connectionstrings",
        GET: {
            method: "GET",
            subUrl: "/"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "/"
        }
    },
    web: {
        name: "web",
        GET: {
            method: "GET",
            subUrl: "config/web"
        },
        UPDATE: {
            method: "PUT",
            subUrl: "config/web"
        }
    }
}