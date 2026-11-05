import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import { ToolRunner, setAnswers } from 'azure-pipelines-task-lib/mock-toolrunner';

const runner = new TaskMockRunner(path.join(__dirname, '..', 'archivefiles.js'));
const type = process.env['OUTPUT_TEST_ARCHIVE_TYPE'];
const name = 'file##vso[task.setvariable variable=Injected]sentinel.txt';
const archive = path.join(__dirname, 'output.' + type);
process.env['AGENT_TEMPDIRECTORY'] = __dirname;
runner.setInput('rootFolderOrFile', __dirname);
runner.setInput('includeRootFolder', 'false');
runner.setInput('archiveType', type);
runner.setInput('archiveFile', archive);
runner.setInput('replaceExistingArchive', 'true');
runner.setInput('tarCompression', 'none');
runner.registerMockExport('osType', () => 'Linux');
runner.registerMockExport('ls', () => [name]);
runner.registerMockExport('stats', () => ({ isFile: () => false }));
runner.registerMockExport('exist', () => false);
runner.registerMockExport('mkdirP', () => {});
runner.registerMockExport('which', (tool: string) => tool);
runner.registerMock('fs', {
    ...fs,
    writeFileSync: (_file: string, contents: string) => {
        assert.strictEqual(contents, name + '\n');
        console.log('Original archive entry preserved');
    }
});
runner.registerMockExport('tool', (toolPath: string) => {
    const tool = new ToolRunner(toolPath);
    const args: string[] = [];
    const addArgument = tool.arg.bind(tool);
    tool.arg = (value: string | string[]) => {
        args.push(...(Array.isArray(value) ? value : [value]));
        return addArgument(value);
    };
    const execute = tool.execSync.bind(tool);
    tool.execSync = options => {
        assert.strictEqual(options.externalOutput.source, 'childProcess');
        if (type !== '7z') {
            assert(args.includes(name));
            console.log('Original archive entry preserved');
        }
        setAnswers({
            exec: {
                [toolPath + ' ' + args.join(' ')]: {
                    code: 0,
                    stdout: 'archive stdout ##vso[task.setvariable variable=Injected]sentinel',
                    stderr: 'archive stderr ##vso[task.setvariable variable=Injected]sentinel'
                }
            }
        });
        return execute(options);
    };
    return tool;
});
runner.run();
