import * as assert from 'assert';
import * as fs from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';
import { flattenObject } from './Helpers/flattenObject';
import { BuildEngine } from '../Common/BuildOutput';

const buildOutputRewired = rewire('../Common/BuildOutput');
const buildOutputClass = buildOutputRewired.__get__('BuildOutput');

export function BuildOutputTests() {
    const sandbox = sinon.createSandbox();
    const buildOutputInstance = new buildOutputClass();

    describe('function \'findModuleOutputs\'', () => {
        before(() => {
            sandbox.stub(glob, 'sync').callsFake();
            sandbox.stub(path, 'join').callsFake();
            sandbox.stub(buildOutputInstance, 'getBuildDirectoryName').callsFake();
            sandbox.stub(buildOutputInstance, 'getModuleName').callsFake();
            sandbox.stub(fs, 'lstatSync').returns({isDirectory: () => true});
            sandbox.stub(tl, 'debug').callsFake();
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            glob.sync.reset();
            buildOutputInstance.getModuleName.reset();
        });

        it('should return correct list of module outputs', () => {
            glob.sync.returns(['first-path', 'second-path']);
            buildOutputInstance.getModuleName
                .onCall(0).returns('first-module')
                .onCall(1).returns('second-module');
            const actual = buildOutputInstance.findModuleOutputs();
            assert.deepStrictEqual(flattenObject(actual), [
                {
                  moduleName: 'first-module',
                  moduleRoot: 'first-path'
                },
                {
                  moduleName: 'second-module',
                  moduleRoot: 'second-path'
                }
            ]);
        });
    });

    describe('function \'getModuleName\'', () => {
        let normalizeStub;

        before(() => {
            sandbox.stub(path, 'basename');
            sandbox.stub(path, 'join');
            normalizeStub = sandbox.stub(path, 'normalize');
            sandbox.stub(buildOutputInstance, 'getBuildDirectoryName');
            sandbox.stub(tl, 'debug');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            normalizeStub.reset();
        });

        it('should return \'root\' if module path equals to root path', () => {
            normalizeStub.returns('some/path');
            const actual = buildOutputInstance.getModuleName('module-path');
            assert.strictEqual(actual, 'root');
        });

        it('should join module path with \'..\' if module path doesn\'t equal to root path', () => {
            normalizeStub
                .onCall(0).returns('some/path')
                .onCall(1).returns('root/path');
            const actual = buildOutputInstance.getModuleName('module-path');
            sinon.assert.calledWithExactly(
                path.join,
                'module-path',
                '..');
        });
    });

    describe('function \'getBuildDirectoryName\'', () => {
        let buildEngineStub;

        before(() => {
            buildEngineStub = sandbox.stub(buildOutputInstance, 'buildEngine');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            buildEngineStub.reset();
        });

        it('should return \'null\' if build engine is unknown', () => {
            buildEngineStub.value('unknown-engine');
            const actual = buildOutputInstance.getBuildDirectoryName();
            assert.strictEqual(actual, null);
        });

        it('should return \'build\' if build engine is gradle', () => {
            buildEngineStub.value(BuildEngine.Gradle);
            const actual = buildOutputInstance.getBuildDirectoryName();
            assert.strictEqual(actual, 'build');
        });

        it('should return \'target\' if build engine is maven', () => {
            buildEngineStub.value(BuildEngine.Maven);
            const actual = buildOutputInstance.getBuildDirectoryName();
            assert.strictEqual(actual, 'target');
        });
    });
}