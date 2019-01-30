import tmrm = require("vsts-task-lib/mock-run");
import { Readable } from "stream";
export function registerLocationHelpersMock(tmr: tmrm.TaskMockRunner) {
    const mockLocationUtils = {
        getServiceUriFromAreaId: function(collectionUrl: string): Promise<string> {
            return Promise.resolve(collectionUrl + "/feed");
        },
        getFeedUriFromBaseServiceUri: function(serviceUri: string) {
            return serviceUri + "/feed";
        },
        getBlobstoreUriFromBaseServiceUri: function(serviceUri: string) {
            return serviceUri + "/blobstore";
        },
        getPackagingUris: function() {
            const collectionUrl: string = "https://vsts/packagesource";
            return {
                PackagingUris: [collectionUrl],
                DefaultPackagingUri: collectionUrl
            };
        },
        getWebApiWithProxy: function() {
            return {
                vsoClient: {
                    getVersioningData: async function() {
                        return { requestUrl: "foobar" };
                    }
                },
                rest: {
                    get: async function(): Promise<any> {
                        return {
                            result: {
                                name: "downloadPath"
                            }
                        };
                    }
                },
                getCoreApi: async function(): Promise<any> {
                    return {
                        http: {
                            get: async function(): Promise<any> {
                                return {
                                    message: new Readable({
                                        read(size) {
                                            this.push("ehhsdfa");
                                            this.push("sdfsdf");
                                            this.push(null);
                                        }
                                    })
                                };
                            }
                        }
                    };
                }
            };
        },
        getSystemAccessToken: function() {
            return "token";
        },
        getFeedRegistryUrl: function(packagingUrl: string, registryType, feedId: string) {
            return packagingUrl + "/" + feedId;
        },
        ProtocolType: { NuGet: 1, Npm: 2, Maven: 3, PyPi: 4 },
        RegistryType: { npm: 1, NuGetV2: 2, NuGetV3: 3, PyPiSimple: 4, PyPiUpload: 5 }
    };

    tmr.registerMock("packaging-common/locationUtilities", mockLocationUtils);
    tmr.registerMock("../locationUtilities", mockLocationUtils);
}
