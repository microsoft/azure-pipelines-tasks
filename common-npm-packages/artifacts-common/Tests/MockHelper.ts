import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as protocols from '../protocols';

export function registerLocationHelpersMock(tmr: tmrm.TaskMockRunner) {
    const mockLocationUtils = {
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

    };
    const mockConnectionDataUtils = {
        getPackagingRouteUrl: function(protocolType: protocols.ProtocolType, apiVersion: string, locationGuid: string, feedId: string, project: string) {
            let url: string = "https://vsts/packagesource";
            if(project != null) {
                url = url + "/" + project;
            }
            return url + "/" + feedId;
        },
        ProtocolType: {NuGet: 1, Npm: 2, Maven: 3, PyPi: 4}
    };

    tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', mockLocationUtils);
    tmr.registerMock('azure-pipelines-tasks-artifacts-common/connectionDataUtils', mockConnectionDataUtils);
    tmr.registerMock('../webapi', mockLocationUtils);
    tmr.registerMock('../connectionDataUtils', mockConnectionDataUtils);
}