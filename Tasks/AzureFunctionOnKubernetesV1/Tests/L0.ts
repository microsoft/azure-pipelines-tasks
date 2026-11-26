import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as tl from 'azure-pipelines-task-lib/task';
import { logConnectionType } from '../src/clusterconnection';

describe('AzureFunctionOnKubernetesV1 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('Does a basic hello world test', function(done: Mocha.Done) {
        // TODO - add real tests
        done();
    });

    it('writes connection type through repository-safe output', function() {
        const originalWriteExternalOutput = tl.writeExternalOutput;
        let output = '';
        let source: string | undefined;
        const connectionType = 'Kubernetes Service Connection\n##vso[task.logissue type=error]injected';
        Object.assign(tl, {
            writeExternalOutput: (message: string | Buffer, options: tl.ExternalOutputOptions) => {
                output = message.toString();
                source = options.source;
            }
        });
        try {
            logConnectionType(connectionType);
        } finally {
            Object.assign(tl, { writeExternalOutput: originalWriteExternalOutput });
        }
        assert.strictEqual(source, 'repository');
        assert(output.includes(connectionType), 'the connection type should be logged as repository-sourced output');
    });
});
