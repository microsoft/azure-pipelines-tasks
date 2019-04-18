import * as tl from 'vsts-task-lib/task';
var mockery = require('mockery');
mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('vsts-task-lib/task', {
    exist: function (path: string) { tl.debug(tl.loc("inexist")); return false; },
    mkdirP: function (path: string) {
        tl.debug(tl.loc("inmkdirp"))
        throw "";
    },
    loc: function (locString, param: string[]) { return tl.loc(locString, param); },
    debug: function (message) { return tl.debug(message); },
    error: function (errorMessage) { return tl.error(errorMessage); },
    getVariable: function (variableName) { return tl.getVariable(variableName); },
    getHttpProxyConfiguration: function () { return ""; },
    setResourcePath: function (path) { return; }
});

import { VersionInstaller } from "../versioninstaller";
try {
    new VersionInstaller("sdk", "C:/unknownlocation");
}
catch (ex) {
    tl.setResult(tl.TaskResult.Failed, "ThrownAsExpected");
}

tl.setResult(tl.TaskResult.Succeeded, "DidNotThrowAsExpected");