import * as mocker from "azure-pipelines-task-lib/lib-mocker";
import * as assert from "assert";

import { setToolProxy } from "./utils"

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.tool = setToolProxy(tlClone.tool);

tlClone.getVariable = variable => {
    if (variable.toLowerCase() == 'agent.tempdirectory') {
        return `temp/path`;
    }
    return null;
}
tlClone.setStdStream({
    write: (msg) => null
});

export function getTempKeychainPathTest() {
    before(() => {
        mocker.disable();
        mocker.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(() => {
        mocker.disable();
    });

    beforeEach(() => {
        mocker.resetCache();
    });

    afterEach(function () {
        mocker.deregisterAll();
    });

    it("should return correct keychain path", (done: MochaDone) => {
        const resultPath = tlClone.resolve(tlClone.getVariable('agent.tempdirectory'), 'ios_signing_temp.keychain');

        mocker.registerMock('azure-pipelines-task-lib/task', tlClone);
        let iosSigning = require("../ios-signing-common");

        assert.ok(iosSigning.getTempKeychainPath().indexOf(resultPath) >= 0);
        done();
    });

}