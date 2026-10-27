import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';
import * as transformations from 'azure-pipelines-tasks-webdeployment-common/fileTransformationsUtility';
import * as utility from 'azure-pipelines-tasks-webdeployment-common/utility';
import * as zip from 'azure-pipelines-tasks-webdeployment-common/ziputility';
import { PackageType, PackageUtility } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';

const isFolder = process.env.TEST_PACKAGE_KIND === 'folder';
const scenario = process.env.TEST_TRANSFORM_SCENARIO;
const packagePath = path.resolve(__dirname, isFolder ? 'raw folder' : 'raw archive.zip');
const folderPath = isFolder ? packagePath : path.resolve(__dirname, 'raw extracted folder');
const target = '**/*.json';
const file = path.join(folderPath, 'app\n##vso[task.setvariable variable=example]payload.json');
const rules = ['-transform web.Release.config -xml web.config'];
const mode = process.env.DISTRIBUTEDTASK_TASKS_ENABLEVSOCOMMANDBLOCKINGRMTASKS === 'true'
    ? 'blockAndTelemetry' : 'telemetryOnly';
const runner = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'filetransform.js'));
const inputs: Record<string, string> = {
    folderPath: packagePath,
    jsonTargetFiles: target,
    xmlTargetFiles: '',
    enableXmlTransform: 'false',
    xmlTransformationRules: rules[0]
};

let calls = 0;
let reads = 0;
let writes = 0;
let extractions = 0;
let archives = 0;
const originalTransform = transformations.enhancedFileTransformations;
const originalRead = fs.readFileSync;
Object.assign(transformations, {
    enhancedFileTransformations: (...args: Parameters<typeof originalTransform>) => {
        calls++;
        assert.deepStrictEqual(args, [isFolder, false, folderPath, rules, [], [target], mode]);
        return originalTransform(...args);
    }
});
PackageUtility.getPackagePath = input => {
    assert.strictEqual(input, packagePath);
    return input;
};
Object.assign(utility, {
    generateTemporaryFolderForDeployment: async (...args: Parameters<typeof utility.generateTemporaryFolderForDeployment>) => {
        extractions++;
        assert.deepStrictEqual(args, [false, packagePath, PackageType.zip]);
        return folderPath;
    },
    findfiles: (pattern: string) => {
        assert.strictEqual(pattern, path.join(folderPath, target));
        return scenario === 'missing' ? [] : [file];
    }
});
Object.assign(zip, {
    archiveFolder: async (...args: Parameters<typeof zip.archiveFolder>) => {
        archives++;
        assert.deepStrictEqual(args, [folderPath, path.dirname(packagePath), path.basename(packagePath)]);
        assert.strictEqual(writes, 1, 'archive must follow substitution');
    }
});
Object.assign(fs, {
    readFileSync: (input: string, ...args: unknown[]) => {
        if (input === file) {
            reads++;
            return Buffer.from(scenario === 'invalid' ? 'not valid json' : '{"setting":"old"}');
        }
        return Reflect.apply(originalRead, fs, [input, ...args]);
    }
});
Object.assign(tl, {
    loc: (key: string, ...args: string[]) => `${key} ${args.join(' ')}`,
    getPathInput: (name: string) => inputs[name],
    getInput: (name: string) => inputs[name],
    getBoolInput: (name: string) => inputs[name] === 'true',
    getDelimitedInput: (name: string, delimiter: string) => (inputs[name] || '').split(delimiter).filter(Boolean),
    exist: (input: string) => input === packagePath,
    stats: (input: string) => {
        assert.strictEqual(input, packagePath);
        return { isDirectory: () => isFolder };
    },
    getVariables: () => [{ name: 'setting', value: 'new', secret: false }],
    writeFile: (input: string, content: string, encoding: string) => {
        assert.strictEqual(input, file, 'writes must use the raw filename');
        assert.deepStrictEqual(JSON.parse(content), { setting: 'new' });
        assert.strictEqual(encoding, 'utf-8');
        writes++;
    }
});
process.once('beforeExit', () => {
    assert.strictEqual(calls, 1);
    assert.strictEqual(extractions, isFolder ? 0 : 1);
    assert.strictEqual(reads, scenario === 'missing' ? 0 : 1);
    assert.strictEqual(writes, scenario ? 0 : 1);
    assert.strictEqual(archives, !isFolder && !scenario ? 1 : 0);
    console.log('filename-diagnostics-verified');
});
runner.run(true);
