import { tlClone } from "./utils";
import { strictEqual } from "assert";
import { Writable, Readable } from "stream";
import { IRequestHandler } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces";
import {
    deregisterMock,
    resetCache,
    registerMock,
    deregisterAll,
    disable,
    enable
} from "mockery";

export const secureFileId = Math.random().toString(36).slice(2, 7);
process.env['SECUREFILE_NAME_' + secureFileId] = 'securefilename';

const tmAnswers = {
    'exist': {
        'System.TeamFoundationCollectionUri': 'System.TeamFoundationCollectionUri',
    },
    'rmRF': {
        'securefilename': undefined
    }
}

class AgentAPI {
    downloadSecureFile() {
        const rs = new Readable();
        rs._read = () => {};
        rs.push('data');
        rs.push(null);
        return rs;
    }
}

class WebApi {
    getTaskAgentApi() {
        return new Promise((resolve) => {
            resolve(new AgentAPI());
        });
    }
}

export const nodeapiMock = {
    WebApi,
    getPersonalAccessTokenHandler() {
        return {} as IRequestHandler;
    }
}

export const fsMock = {
    createWriteStream() {
        const ws = new Writable();
        ws._write = function (chunk, encoding, done) {
            done();
        };

        return ws;
    }
};

const getMaxRetries = (maxRetries?: number) => maxRetries >= 0 ? maxRetries : 5;

describe("securefiles-common package suites", function() {
    before(() => {
        enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(() => {
        deregisterAll();
        disable();
    });

    beforeEach(() => {
        resetCache();
        registerMock("azure-pipelines-task-lib/task", tlClone);
        tlClone.setAnswers(tmAnswers);
    });

    afterEach(() => {
        deregisterMock("azure-pipelines-task-lib/task");
        deregisterMock("fs");
    });

    const secureFilesHelpersProps = [
        [ 10, 1000],
        [ undefined, undefined ],
        [ undefined, 30 ],
        [ 3, undefined ]
    ];

    secureFilesHelpersProps.forEach((args) => {
        const [ maxRetries, socketTimeout ] = args;

        it(`Check SecureFileHelpers instance properties with args: [${maxRetries}, ${socketTimeout}]`, async() => {
            const secureFiles = require("../securefiles-common");
            const secureFileHelpers = new secureFiles.SecureFileHelpers(...args);

            strictEqual(secureFileHelpers.serverConnection.options.maxRetries, getMaxRetries(maxRetries), `Result should be equal ${maxRetries}`);
            strictEqual(secureFileHelpers.serverConnection.options.socketTimeout, socketTimeout, `Result should be equal ${socketTimeout}`);
        });
    });

    it("Check downloadSecureFile", async() => {
        registerMock("azure-devops-node-api", nodeapiMock);
        registerMock("fs", fsMock);
        const secureFiles = require("../securefiles-common");
        const secureFileHelpers = new secureFiles.SecureFileHelpers();
        const secureFilePath = await secureFileHelpers.downloadSecureFile(secureFileId);
        const pseudoResolvedPath = await secureFileHelpers.getSecureFileTempDownloadPath(secureFileId);
        strictEqual(secureFilePath, pseudoResolvedPath, `Result should be equal to ${pseudoResolvedPath}`);
    });

    it("Check deleteSecureFile", async() => {
        const secureFiles = require("../securefiles-common");
        const secureFileHelpers = new secureFiles.SecureFileHelpers();
        secureFileHelpers.deleteSecureFile(secureFileId);
    });

    it("Check getSecureFileTempDownloadPath", async() => {
        const secureFiles = require("../securefiles-common");
        const secureFileHelpers = new secureFiles.SecureFileHelpers();
        const resolvedPath = secureFileHelpers.getSecureFileTempDownloadPath(secureFileId);
        const pseudoResolvedPath = tlClone.resolve(tlClone.getVariable("Agent.TempDirectory"), tlClone.getSecureFileName(secureFileId));
        strictEqual(resolvedPath, pseudoResolvedPath, `Resolved path "${resolvedPath}" should be equal to "${pseudoResolvedPath}"`);
    });
});
