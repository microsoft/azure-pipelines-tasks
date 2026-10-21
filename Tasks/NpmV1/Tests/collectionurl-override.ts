import * as path from 'path';

import { NpmCommand, NpmTaskInput } from '../constants';
import { NpmMockHelper } from './NpmMockHelper';

const taskPath = path.join(__dirname, '..', 'npm.js');
const tmr = new NpmMockHelper(taskPath);

// Scenario parameters are passed by L0.ts through the environment.
const command = process.env['TEST_NPM_COMMAND'] || NpmCommand.Install;
const hostedVerifierRejects = process.env['TEST_VERIFIER_REJECTS'] === 'true';

// NpmMockHelper sets its own collection URI, so apply the scenario value afterwards.
if (process.env['TEST_COLLECTION_URI']) {
    process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = process.env['TEST_COLLECTION_URI'];
}

tmr.setInput(NpmTaskInput.Command, command);
tmr.setInput(NpmTaskInput.WorkingDir, '');

tmr.registerMock('azure-pipelines-tasks-artifacts-common/feedUrlUtils', {
    verifyAzureArtifactsFeedUrl: async (url: string, protocol: any): Promise<URL> => {
        console.log(`VERIFIER_CALLED url=${url} protocol=${protocol}`);
        if (hostedVerifierRejects) {
            throw new Error('VERIFIER_REJECTED');
        }
        return new URL(url);
    }
});

const handler = {
    run: async (packagingLocation: any): Promise<void> => {
        console.log(`HANDLER_INVOKED default=${packagingLocation.DefaultPackagingUri}`);
        console.log(`HANDLER_URIS=${JSON.stringify(packagingLocation.PackagingUris)}`);
    }
};
tmr.registerMock('./npmcustom', handler);
tmr.registerMock('./npmpublish', handler);

tmr.run();
