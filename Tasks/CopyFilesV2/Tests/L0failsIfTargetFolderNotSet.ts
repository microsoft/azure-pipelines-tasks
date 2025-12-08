import fs = require('fs');
import mockanswer = require('azure-pipelines-task-lib/mock-answer');
import mockrun = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'copyfiles.js');
let runner: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
runner.setInput('Contents', '**');
runner.setInput('SourceFolder', path.normalize('/srcDir'));
runner.setInput('CleanTargetFolder', 'false');
runner.setInput('Overwrite', 'false');
let answers = <mockanswer.TaskLibAnswers> {
    checkPath: { },
};
answers.checkPath[path.normalize('/srcDir')] = true;
runner.setAnswers(answers);

// as a precaution, disable fs.chmodSync. it should not be called during this scenario.
fs.chmodSync = null;
runner.registerMock('fs', fs);

runner.run();
