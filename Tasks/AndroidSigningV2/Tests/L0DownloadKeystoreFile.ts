import * as path from 'path';

import { TaskMockRunner } from 'vsts-task-lib/mock-run';

import * as secureFileHelperMock from 'securefiles-common/securefiles-common-mock';
import * as sinon from 'sinon';

const taskPath = path.join(__dirname, '..', 'preandroidsigning.js');
const taskRunner = new TaskMockRunner(taskPath);

const getInput = sinon.stub();
getInput.withArgs('keystoreFile').returns('mySecureFileId');
taskRunner.registerMockExport('getInput', getInput);

const getBoolInput = sinon.stub();
getBoolInput.withArgs('jarsign').returns(true);
taskRunner.registerMockExport('getBoolInput', getBoolInput);

const getVariable = sinon.stub();
getVariable.withArgs('AGENT_VERSION').returns('2.116.0');
taskRunner.registerMockExport('getVariable', getVariable);

const getTaskVariable = sinon.stub();
getTaskVariable.withArgs('KEYSTORE_FILE_PATH').returns('/some/store');
taskRunner.registerMockExport('getTaskVariable', getTaskVariable);

taskRunner.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

taskRunner.registerMock('fs', {
    writeFileSync: () => {}
});

taskRunner.run();
