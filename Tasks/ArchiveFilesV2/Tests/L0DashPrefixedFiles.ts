import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'archivefiles.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['AGENT_TEMPDIRECTORY'] = path.join(__dirname, 'test_temp');

tmr.setInput('rootFolderOrFile', process.env['rootFolderOrFile']);
tmr.setInput('includeRootFolder', 'false');
tmr.setInput('archiveType', process.env['archiveType']);
tmr.setInput('archiveFile', process.env['archiveFile']);
tmr.setInput('replaceExistingArchive', 'true');
tmr.setInput('tarCompression', 'none');

tmr.run(true);
