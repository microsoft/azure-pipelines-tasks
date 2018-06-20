import * as path from 'path';

import * as tmrm from 'vsts-task-lib/mock-run';

import * as secureFileHelperMock from 'securefiles-common/securefiles-common-mock';
import * as sinon from 'sinon';

let taskPath = path.join(__dirname, '..', 'preandroidsigning.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('jarsign', 'true');
tr.setInput('keystoreFile', 'mySecureFileId');

const getVariable = sinon.stub();
getVariable.withArgs('AGENT_VERSION').returns('2.116.0');
tr.registerMockExport('getVariable', getVariable);

const getTaskVariable = sinon.stub();
getTaskVariable.withArgs('KEYSTORE_FILE_PATH').returns('/some/store');
tr.registerMockExport('getTaskVariable', getTaskVariable);

tr.registerMock('securefiles-common/securefiles-common', secureFileHelperMock);

tr.registerMock('fs', {
    writeFileSync: () => {}
});

tr.run();
