import * as os from 'os';
import * as path from 'path';
import * as Q from 'q';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const runner = new TaskMockRunner(path.join(__dirname, '..', 'anttask.js'));
const scenario = process.env['ANT_PROCESS_SCENARIO'];
const antTool = scenario === 'failedBuildError' ?
    '/usr/local/bin/ANT' + os.EOL + '##vso[task.setvariable variable=AntProcessErrorMarker;]unexpected-error' :
    '/usr/local/bin/ANT';
let command = antTool + ' -buildfile /build/build.xml';

answers.successAnswers.which.ant = antTool;
answers.successAnswers.checkPath[antTool] = true;
answers.successAnswers.exec[antTool + ' -version'] = { code: 0 };

runner.setInput('antBuildFile', '/build/build.xml');
runner.setInput('javaHomeSelection', 'JDKVersion');
runner.setInput('jdkVersion', 'default');
runner.setInput('testResultsFiles', '**/TEST-*.xml');

if (scenario === 'version') {
    command = antTool + ' -version';
} else if (scenario === 'coverage') {
    command += ' CodeCoverage_9064e1d0';
    runner.setInput('codeCoverageTool', 'JaCoCo');
    runner.setInput('classFilesDirectories', '/classes');
    const summaryFile = path.join('/build', 'CCReport43F6D5EF', 'summary.xml');
    runner.registerMockExport('stats', (file: string) => ({ isFile: () => file === summaryFile }));
    runner.registerMock('azure-pipelines-tasks-codecoverage-tools/codecoveragefactory', {
        CodeCoverageEnablerFactory: class {
            getTool() {
                return { enableCodeCoverage: () => Q.resolve(true) };
            }
        }
    });
}

answers.successAnswers.exec[command] = {
    code: scenario === 'failedBuild' || scenario === 'failedBuildError' ? 1 : 0,
    stdout: 'ordinary stdout' + os.EOL +
        '##vso[task.setvariable variable=AntProcessStdoutMarker;]unexpected-stdout',
    stderr: 'ordinary stderr' + os.EOL +
        '##vso[task.setvariable variable=AntProcessStderrMarker;]unexpected-stderr'
};
runner.setAnswers(answers.successAnswers);
runner.run();
