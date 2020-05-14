import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'archivefiles.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

process.env['AGENT_TEMPDIRECTORY'] = path.join(__dirname, 'test_temp');

tmr.setInput('rootFolderOrFile', path.join(__dirname, 'test_folder'));
tmr.setInput('includeRootFolder', process.env['includeRootFolder']);
tmr.setInput('archiveType', process.env['archiveType']);
tmr.setInput('archiveFile', path.join('test_output', process.env['archiveFile']));
tmr.setInput('replaceExistingArchive', 'true');
tmr.setInput('tarCompression', 'gz');

tmr.run(true);