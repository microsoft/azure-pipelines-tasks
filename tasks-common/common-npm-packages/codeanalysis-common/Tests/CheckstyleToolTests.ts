import * as assert from 'assert';
import * as glob from 'glob';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';

import { BuildEngine, BuildOutput } from '../Common/BuildOutput';

export function CheckstyleToolTests() {
    const sandbox = sinon.createSandbox();
    const checkstyleToolRewired = rewire('../Common/CheckstyleTool');
    const checkstyleToolClass = checkstyleToolRewired.__get__('CheckstyleTool');
    const checkstyleToolInstance = new checkstyleToolClass();

    describe('function \'configureBuild\'', () => {
        let buildOutputStub;
        let isEnabledStub;
        let joinStub;

        class FakeToolRunner {
            public args: string;
            public arg(val: any[]) {
                this.args = val.join(' ');
                return this;
            }
        }

        before(() => {
            isEnabledStub = sandbox.stub(checkstyleToolInstance, 'isEnabled');
            buildOutputStub = sandbox.stub(checkstyleToolInstance, 'buildOutput');
            sandbox.stub(console, 'log');
            sandbox.stub(tl, 'loc');
            joinStub = sandbox.stub(path, 'join');

        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            isEnabledStub.reset();
            buildOutputStub.reset();
        });

        it('should return Tool Runner with untouched args if isEnabled returns \'false\'', () => {
            isEnabledStub.returns(false);
            const actual = checkstyleToolInstance.configureBuild(new FakeToolRunner());
            assert.strictEqual(actual.args, undefined);
        });

        it('should return Tool Runner with args \'checkstyle:checkstyle\' if build engine is maven', () => {
            isEnabledStub.returns(true);
            buildOutputStub.value({
                buildEngine: BuildEngine.Maven
            });
            const actual = checkstyleToolInstance.configureBuild(new FakeToolRunner());
            assert.strictEqual(actual.args, 'checkstyle:checkstyle');
        });

        it('should return Tool Runner with initialize script in args if build engine is gradle', () => {
            isEnabledStub.returns(true);
            buildOutputStub.value({
                buildEngine: BuildEngine.Gradle
            });
            joinStub.returns('some/init/script/path');
            const actual = checkstyleToolInstance.configureBuild(new FakeToolRunner());
            assert.strictEqual(actual.args, '-I some/init/script/path');
        });

        it('should return Tool Runner with untouched args if build engine is unknown', () => {
            isEnabledStub.returns(true);
            buildOutputStub.value({
                buildEngine: 'unknown-engine'
            });
            joinStub.returns('some/init/script/path');
            const actual = checkstyleToolInstance.configureBuild(new FakeToolRunner());
            assert.strictEqual(actual.args, undefined);
        });
    });

    describe('function \'getBuildReportDir\'', () => {
        let buildOutputStub;
        let joinStub;

        before(() => {
            buildOutputStub = sandbox.stub(checkstyleToolInstance, 'buildOutput');
            joinStub = sandbox.stub(path, 'join');
            sandbox.stub(tl, 'debug');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            buildOutputStub.reset();
            joinStub.reset();
        });

        it('should call \'path.join\' with correct parameters if build engine is Maven', () => {
            buildOutputStub.value({
                buildEngine: BuildEngine.Maven
            });
            checkstyleToolInstance.getBuildReportDir({
                moduleName: 'module-name',
                moduleRoot: 'module/root/path'
            });
            sinon.assert.calledOnceWithExactly(joinStub, 'module/root/path');
        });

        it('should call \'path.join\' with correct parameters if build engine is Gradle', () => {
            buildOutputStub.value({
                buildEngine: BuildEngine.Gradle
            });
            checkstyleToolInstance.getBuildReportDir({
                moduleName: 'module-name',
                moduleRoot: 'module/root/path'
            });
            sinon.assert.calledOnceWithExactly(joinStub, 'module/root/path', 'reports', 'checkstyle');
        });

        it('should throw exception if build engine is unknown', () => {
            buildOutputStub.value({
                buildEngine: 'unknown-engine'
            });
            assert.throws(() => {
                checkstyleToolInstance.getBuildReportDir({
                    moduleName: 'module-name',
                    moduleRoot: 'module/root/path'
                });
            });
        });
    });

    describe('function \'findHtmlReport\'', () => {
        let syncStub;

        before(() => {
            sandbox.stub(path, 'basename');
            sandbox.stub(path, 'dirname');
            sandbox.stub(path, 'join');
            syncStub = sandbox.stub(glob, 'sync');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            syncStub.reset();
        });

        it('should return first found html report #1', () => {
            syncStub
                .onCall(0).returns(['fist-report', 'second-report', 'third-report']);
            const actual = checkstyleToolInstance.findHtmlReport('some-xml-report');
            assert.strictEqual(actual, 'fist-report');
        });

        it('should return first found html report #2 ', () => {
            syncStub
                .onCall(0).returns([])
                .onCall(1).returns(['report-1', 'report-2', 'report-3', 'report-4']);
            const actual = checkstyleToolInstance.findHtmlReport('some-xml-report');
            assert.strictEqual(actual, 'report-1');
        });
    });
}