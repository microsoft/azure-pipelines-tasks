import * as mocker from "azure-pipelines-task-lib/lib-mocker";
import * as assert from "assert";
import VersionInfoVersion from '../../pe-parser/VersionInfoVersion'
import {VersionInfo} from '../../pe-parser/VersionResource'

export function nugettoolgetter() {
    let mockTask = {
        which: function() {
            return "C:/fakePath";
        },
        getHttpProxyConfiguration: function() {
            return null;
        },
        getHttpCertConfiguration: function() {
            return null;
        },
        setResourcePath: function() {
            return null;
        },
        debug(message: string) {},
        loc(message: string): string { return message; },
        getVariable: function() {
            return null;
        },
        tool: function() {
            return null;
        }
    };

    before(() => {
        mocker.disable(); // needed to ensure that we can mock vsts-task-lib/task
        mocker.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        } as mocker.MockOptions);
    });

    after(() => {
        mocker.disable();
    });

    beforeEach(() => {
        mocker.resetCache();
        mocker.registerMock('azure-pipelines-task-lib/task', mockTask);
    });

    afterEach(() => {
        mocker.deregisterAll();
    });

    it("Resolve correct nuget version based on msbuild 15", async() => {    
        mocker.registerMock('../pe-parser', {
            getFileVersionInfoAsync: function(msbuildPath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(15, 0, 0, 0);
                result.productVersion = new VersionInfoVersion(15, 0, 0, 0);
                result.strings['ProductVersion'] = "15.0.0.0";
                return result;
            }
        });
        let ngToolGetterMock = require("../../nuget/NuGetToolGetter");
        let msbuildVersion : string = await ngToolGetterMock.getMSBuildVersionString();
        assert.equal(msbuildVersion, "15.0.0.0");
        let nugetVersion = await ngToolGetterMock.resolveNuGetVersion();
        assert.equal(nugetVersion, "4.9.6");
    });
    
    it("Resolve correct nuget version based on msbuild 16.12", async() => {    
        mocker.registerMock('../pe-parser', {
            getFileVersionInfoAsync: function(msbuildPath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(16, 12, 0, 0);
                result.productVersion = new VersionInfoVersion(16, 12, 0, 0);
                result.strings['ProductVersion'] = "16.12.0.0";
                return result;
            }
        });
        let ngToolGetterMock = require("../../nuget/NuGetToolGetter");
        let msbuildVersion : string = await ngToolGetterMock.getMSBuildVersionString();
        assert.equal(msbuildVersion, "16.12.0.0");
        let nugetVersion = await ngToolGetterMock.resolveNuGetVersion();
        assert.equal(nugetVersion, "5.9.3");
    });

    it("Resolve correct nuget version based on msbuild 17.1", async() => {    
        mocker.registerMock('../pe-parser', {
            getFileVersionInfoAsync: function(msbuildPath) {
                let result: VersionInfo = { strings: {} };
                result.fileVersion = new VersionInfoVersion(17, 1, 0, 0);
                result.productVersion = new VersionInfoVersion(17, 1, 0, 0);
                result.strings['ProductVersion'] = "17.1.0.0";
                return result;
            }
        });
        let ngToolGetterMock = require("../../nuget/NuGetToolGetter");
        let msbuildVersion : string = await ngToolGetterMock.getMSBuildVersionString();
        assert.equal(msbuildVersion, "17.1.0.0");
        let nugetVersion = await ngToolGetterMock.resolveNuGetVersion();
        assert.equal(nugetVersion, "6.4.0");
    });
}