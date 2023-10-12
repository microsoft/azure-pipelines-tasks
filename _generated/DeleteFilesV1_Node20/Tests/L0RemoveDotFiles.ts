import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'deletefiles.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const testRoot: string = path.join(__dirname, "test_structure", "removeDotFiles");

tmr.setInput('Contents', '/**/*.txt');
tmr.setInput('SourceFolder', testRoot);
tmr.setInput('RemoveDotFiles', "true");

tmr.run(true);
