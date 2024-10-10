import * as assert from 'assert';
import * as glob from 'glob';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';

import { BuildOutput } from '../Common/BuildOutput';
import { flattenObject } from './Helpers/flattenObject';

const baseToolRewired = rewire('./Fakes/FakeTool');
const baseToolClass = baseToolRewired.__get__('FakeTool');

export function BaseToolTests() {
    const sandbox = sinon.createSandbox();
    const baseToolInstance = new baseToolClass();

    describe('function \'processResults\'', () => {
        let isEnabledStub;
        let parseModuleOutputStub;

        before(() => {
            sandbox.stub(tl, 'debug').callsFake();
            const buildOutputStub = sinon.createStubInstance(BuildOutput, {
                findModuleOutputs: [{
                    moduleName: 'Module1',
                    modulePath: 'ModulePath1'
                },
                {
                    moduleName: 'Module2',
                    modulePath: 'ModulePath2'
                }]
            });
            isEnabledStub = sandbox.stub(baseToolInstance, 'isEnabled').returns(false);
            parseModuleOutputStub = sandbox.stub(baseToolInstance, 'parseModuleOutput').returns([]);
            sandbox.stub(baseToolInstance, 'buildOutput').value(buildOutputStub);
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            isEnabledStub.reset();
            parseModuleOutputStub.reset();
        });

        it('should return empty array if BaseClass is disabled', () => {
            isEnabledStub.returns(false);
            const actual = baseToolInstance.processResults();
            assert.strictEqual(actual.length, 0);
        });

        it('should return array with two items', () => {
            isEnabledStub.returns(true);
            parseModuleOutputStub.returns({
                originatingTool: null,
                moduleName: 'SomeModuleName',
                resultFiles: [],
                violationCount: 1,
                affectedFileCount: 2
            });
            const actual = baseToolInstance.processResults();
            assert.strictEqual(actual.length, 2);
        });

        it('should return array with one item', () => {
            isEnabledStub.returns(true);
            parseModuleOutputStub
                .onFirstCall().returns({
                    originatingTool: null,
                    moduleName: 'SomeModuleName',
                    resultFiles: [],
                    violationCount: 1,
                    affectedFileCount: 2
                })
                .onSecondCall().returns(null);
            const actual = baseToolInstance.processResults();
            assert.strictEqual(actual.length, 1);
        });
    });

    describe('function \'isEnabled\'', () => {
        let getBoolInputStub;

        before(() => {
            getBoolInputStub = sandbox.stub(tl, 'getBoolInput').returns();
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            getBoolInputStub.reset();
        });

        it('should return true if \'getBoolInput\' returns true', () => {
            getBoolInputStub.returns(true);
            const actual = baseToolInstance.isEnabled();
            assert.strictEqual(actual, true);
        });

        it('should return false if \'getBoolInput\' returns false', () => {
            getBoolInputStub.returns(false);
            const actual = baseToolInstance.isEnabled();
            assert.strictEqual(actual, false);
        });
    });

    describe('function \'findHtmlReport\'', () => {
        let syncStub;

        before(() => {
            sandbox.stub(path, 'basename').returns();
            sandbox.stub(path, 'dirname').returns();
            sandbox.stub(path, 'join').returns();
            syncStub = sandbox.stub(glob, 'sync').returns();
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            syncStub.reset();
        });

        it('should return null if there are not found html reports', () => {
            syncStub.returns([]);
            const actual = baseToolInstance.findHtmlReport('report-name');
            assert.strictEqual(actual, null);
        });

        it('should return first report if there are several found html reports', () => {
            syncStub.returns(['first-report', 'second-report', 'third-report']);
            const actual = baseToolInstance.findHtmlReport('report-name');
            assert.strictEqual(actual, 'first-report');
        });
    });

    describe('function \'parseModuleOutput\'', () => {
        let syncStub;
        let buildAnalysisResultFromModuleStab;

        before(() => {
            syncStub = sandbox.stub(glob, 'sync').returns();
            sandbox.stub(baseToolInstance, 'getBuildReportDir').returns();
            buildAnalysisResultFromModuleStab = sandbox.stub(baseToolInstance, 'buildAnalysisResultFromModule').returns();
            sandbox.stub(path, 'join').returns();
            sandbox.stub(tl, 'debug').callsFake();
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            syncStub.reset();
        });

        it('should return null if no xml reports found', () => {
            syncStub.returns([]);
            const actual = baseToolInstance.parseModuleOutput({
                moduleName: 'Module1',
                modulePath: 'ModulePath1'
            });
            assert.strictEqual(actual, null);
        });

        it('should call \'buildAnalysisResultFromModule\' with correct arguments', () => {
            syncStub.returns(['first-report', 'second-report']);
            const actual = baseToolInstance.parseModuleOutput({
                moduleName: 'Module1',
                modulePath: 'ModulePath1'
            });
            sinon.assert.calledOnceWithExactly(
                buildAnalysisResultFromModuleStab,
                ['first-report', 'second-report'],
                'Module1');
        });
    });

    describe('function \'buildAnalysisResultFromModule\'', () => {
        let parseXmlReportStub;
        let findHtmlReportStub;
        let debugStub;

        before(() => {
            debugStub = sandbox.stub(tl, 'debug').callsFake();
            parseXmlReportStub = sandbox.stub(baseToolInstance, 'parseXmlReport').returns();
            findHtmlReportStub = sandbox.stub(baseToolInstance, 'findHtmlReport').returns();
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            debugStub.resetHistory();
            parseXmlReportStub.reset();
            findHtmlReportStub.reset();
        });

        it('should return correct object and output 3 debug messages', () => {
            parseXmlReportStub
                .onCall(0).returns(null)
                .onCall(1).returns([0, 0])
                .onCall(0).returns([12, 5])
                .onCall(0).returns([3, 7]);
            findHtmlReportStub
                .onCall(0).returns(null)
                .returns('some-html-report');
            const actual = baseToolInstance.buildAnalysisResultFromModule([
                'first-report', 'second-report', 'third-report', 'fourth-report'],
                'module-name');
            assert.deepStrictEqual(flattenObject(actual), {
                affectedFileCount: 7,
                moduleName: 'module-name',
                originatingTool: {},
                resultFiles: ['first-report'],
                violationCount: 3
            });
            sinon.assert.callCount(debugStub, 3);
        });
    });
}