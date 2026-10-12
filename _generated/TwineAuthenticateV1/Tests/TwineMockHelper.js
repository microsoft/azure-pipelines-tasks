"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwineMockHelper = void 0;
const pkgMock = require("azure-pipelines-tasks-artifacts-common/Tests/MockHelper");
const path = require("path");
class TwineMockHelper {
    constructor(tmr) {
        this.tmr = tmr;
        this.tmr.setInput('verbosity', "verbose");
        const pypircPath = path.join(__dirname, "temp");
        process.env['AGENT_HOMEDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['PYPIRC_PATH'] = pypircPath + path.sep + ".pypirc";
        process.env['BUILD_SOURCESDIRECTORY'] = "c:\\agent\\home\\directory\\sources",
            process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "c:\\agent\\home\\directory";
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = "https://example.visualstudio.com/defaultcollection";
        process.env['SYSTEM_SERVERTYPE'] = "hosted";
        pkgMock.registerLocationHelpersMock(tmr);
    }
}
exports.TwineMockHelper = TwineMockHelper;
