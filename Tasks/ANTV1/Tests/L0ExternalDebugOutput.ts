import * as assert from 'assert';
import * as path from 'path';
import * as Q from 'q';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const runner = new TaskMockRunner(path.join(__dirname, '..', 'anttask.js'));
const scenario = process.env['ANT_DEBUG_SCENARIO'];
const value = process.env['ANT_DEBUG_VALUE'];
const buildFile = scenario === 'coverage' ? path.join('/build', value, 'build.xml') : '/build/build.xml';
const home = '/home/' + value;

runner.setInput('antBuildFile', buildFile);
runner.setInput('javaHomeSelection', 'Path');
runner.setInput('jdkUserInputPath', home);
runner.setInput('antHomeUserInputPath', home);
runner.setInput('testResultsFiles', '**/TEST-*.xml');

answers.successAnswers.checkPath[buildFile] = true;
answers.successAnswers.checkPath[home] = true;
answers.successAnswers.exec['/usr/local/bin/ANT -buildfile ' + buildFile] = { code: 0 };
runner.setAnswers(answers.successAnswers);
runner.registerMock('azure-pipelines-tasks-java-common/java-common', {
    publishJavaTelemetry: () => {}
});

if (scenario === 'coverage') {
    runner.setInput('codeCoverageTool', 'JaCoCo');
    runner.setInput('classFilesDirectories', '/classes');
    answers.successAnswers.exec['/usr/local/bin/ANT -buildfile ' + buildFile + ' CodeCoverage_9064e1d0'] = { code: 0 };
    const summaryFile = path.join(path.dirname(buildFile), 'CCReport43F6D5EF', 'summary.xml');
    runner.registerMockExport('stats', (file: string) => ({ isFile: () => file === summaryFile }));
    runner.registerMockExport('rmRF', () => { throw new Error(value); });
    runner.registerMock('azure-pipelines-tasks-codecoverage-tools/codecoveragefactory', {
        CodeCoverageEnablerFactory: class {
            getTool() {
                return { enableCodeCoverage: () => Q.resolve(true) };
            }
        }
    });
} else if (scenario === 'error') {
    runner.registerMockExport('which', () => { throw new Error(value); });
} else {
    process.on('beforeExit', () => {
        assert.strictEqual(process.env['ANT_HOME'], home, 'Filtering should not change ANT_HOME');
        assert.strictEqual(process.env['JAVA_HOME'], home, 'Filtering should not change JAVA_HOME');
    });
}

runner.run();
