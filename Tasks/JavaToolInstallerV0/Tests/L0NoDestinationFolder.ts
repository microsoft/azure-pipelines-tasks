import mockanswer = require('vsts-task-lib/mock-answer');
import mockrun = require('vsts-task-lib/mock-run');
import path = require('path');

const taskPath = path.join(__dirname, '..', 'javatoolinstaller.js');
const srcPath = 'source/foo.zip';
const destDir = '/destDir';
const tr: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
tr.setInput("versionSpec", "8.1");
tr.setInput("jdkSource", "Local Directory")
tr.setInput("jdkPath", srcPath);
//tr.setInput('destinationFolder', 'dirName');
tr.setInput("cleanDestinationFolder", "false");

// provide answers for task mock
const a: mockanswer.TaskLibAnswers = <mockanswer.TaskLibAnswers>{
    checkPath: { },
    find: { },
    rmRF: { },
};
tr.setAnswers(a);

tr.run();
