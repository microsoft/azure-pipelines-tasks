import tmrm = require('azure-pipelines-task-lib/mock-run');
	
export function registerLocationHelpersMock(tmr: tmrm.TaskMockRunner) {
    const mockLocationUtils = {
        getFeedUriFromBaseServiceUri: function (serviceUri: string, accesstoken: string) {
            return serviceUri + "/feed"
        },
        getBlobstoreUriFromBaseServiceUri: function (serviceUri: string, accesstoken: string) {
            return serviceUri + "/blobstore"
        },
        getPackagingUris: function(input) {
            const collectionUrl: string = "https://vsts/packagesource";
            return {
                PackagingUris: [collectionUrl],
                DefaultPackagingUri: collectionUrl
            };
        },
        getWebApiWithProxy: function(serviceUri: string, accessToken?: string) {
            return {
                vsoClient: {
                    getVersioningData: async function (ApiVersion: string, PackagingAreaName: string, PackageAreaId: string, Obj) {
                        return { requestUrl: 'foobar' };
                    }
                }
            }
        },
        getSystemAccessToken: function() {
            return "token";
        },
        getFeedRegistryUrl: function(packagingUrl: string, registryType, feedId: string, accessToken?: string) {
            return packagingUrl + "/" + feedId;
        },
        ProtocolType: {NuGet: 1, Npm: 2, Maven: 3, PyPi: 4},
        RegistryType: {npm: 1, NuGetV2: 2, NuGetV3: 3, PyPiSimple: 4, PyPiUpload: 5}
    };

    tmr.registerMock('packaging-common/locationUtilities', mockLocationUtils);
    tmr.registerMock('../locationUtilities', mockLocationUtils);
}