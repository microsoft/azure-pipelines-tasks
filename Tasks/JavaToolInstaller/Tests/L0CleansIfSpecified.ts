import fs = require('fs');
import mockanswer = require('vsts-task-lib/mock-answer');
import mockrun = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'javatoolinstaller.js');
let srcPath = 'source/foo.zip';
let destDir = '/destDir';
let tr: mockrun.TaskMockRunner = new mockrun.TaskMockRunner(taskPath);
tr.setInput("versionSpec", "8.1");
tr.setInput("jdkSource", "Local Directory")
tr.setInput("jdkPath", srcPath);
tr.setInput("destinationFolder", destDir);
tr.setInput("cleanDestinationFolder", "true");
let answers = <mockanswer.TaskLibAnswers> {
    checkPath: { },
    find: { },
    rmRF: { },
};
answers.checkPath[path.normalize(srcPath)] = true;
answers.find[path.normalize(srcPath)] = [
    path.normalize(srcPath)
];
answers.rmRF[path.join(path.normalize('/destDir/clean-subDir'))] = { success: true };
answers.rmRF[path.join(path.normalize('/destDir/clean-file.txt'))] = { success: true };
tr.setAnswers(answers);
tr.registerMockExport('stats', (itemPath: string) => {
    console.log('##vso[task.debug]stats ' + itemPath);
    switch (itemPath) {
        case path.normalize(srcPath):
            return { isFile: () => true };
        default:
            throw { code: 'ENOENT' };
    }
});
let origReaddirSync = fs.readdirSync;
fs.readdirSync = (p: string | Buffer) => {
    console.log('HERE path ' + p);
    let result: string[];
    if (p == path.normalize(destDir)) {
        result = [ 'clean-subDir', 'clean-file.txt' ];
    }
    else {
        result = origReaddirSync(p);
    }

    return result;
}

// as a precaution, disable fs.chmodSync. it should not be called during this scenario.
fs.chmodSync = null;
tr.registerMock('fs', fs);

tr.run();
