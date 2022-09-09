import * as assert from 'assert';
import * as ccc from "../codecoverageconstants";
import * as expectedResults from "./data/expectedResults";
import * as fakeData from "./data/fakeData"
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "../utilities";

export function jacocogradleccenablerTests() {
    const sandbox = sinon.createSandbox();
    const jacocogradleenablerRewired = rewire('../jacoco/jacoco.gradle.ccenabler');
    const jacocoGradleCodeCoverageEnablerClass = jacocogradleenablerRewired.__get__('JacocoGradleCodeCoverageEnabler')
    const jacocoGradleCodeCoverageEnablerInstance = new jacocoGradleCodeCoverageEnablerClass();

    describe('function applyFilterPattern', () => {
        let isNullOrWhitespaceStub;

        before(() => {
            sandbox.stub(tl, "debug").callsFake();
            sandbox.stub(util, "trimToEmptyString").callsFake((value) => value);
            isNullOrWhitespaceStub = sandbox.stub(util, "isNullOrWhitespace").callsFake();
        });
    
        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            isNullOrWhitespaceStub.reset();
        })

        it('should return empty array if filter is empty', () => {
            isNullOrWhitespaceStub.returns(true);
            const actual = jacocoGradleCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, []);
        });
    
        it('should return correct array of filters', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = jacocoGradleCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, expectedResults.jacocoCorrectedAppliedFilterPatter);
        });
    });

    describe('function enableCodeCoverage', () => {
        let appendTextToFileSync;

        before(() => {
            sandbox.stub(tl, "debug").callsFake();
            sandbox.stub(tl, "warning").callsFake();
            sandbox.stub(tl, "loc").callsFake();
            sandbox.stub(jacocoGradleCodeCoverageEnablerInstance, "extractFilters").returns(fakeData.filters);
            sandbox.stub(jacocoGradleCodeCoverageEnablerInstance, "applyFilterPattern")
                .onCall(0)
                .returns(fakeData.excludeFilter)
                .onCall(1)
                .returns(fakeData.includeFilter);
            sandbox.stub(ccc, "jacocoGradleMultiModuleEnable").returns('Multi-Module Configuration');
            sandbox.stub(ccc, "jacocoGradleSingleModuleEnable").returns('Single-MOdule Configuration');
            appendTextToFileSync = sandbox.stub(util, "appendTextToFileSync").callsFake();
        });
    
        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            sandbox.resetHistory();
        })

        it('should call \'jacocoGradleMultiModuleEnable\' if project is multi-module', async () => {
            const actual = await jacocoGradleCodeCoverageEnablerInstance.enableCodeCoverage(
                {
                    buildfile: fakeData.buildFile,
                    classfilter: fakeData.classFilter,
                    classfilesdirectories: fakeData.classDir,
                    summaryfile: fakeData.summaryFile,
                    reportdirectory: fakeData.reportDir,
                    ismultimodule: 'true',
                    gradle5xOrHigher: 'true'
                });
            sandbox.assert.calledOnce(ccc.jacocoGradleMultiModuleEnable);
            assert.strictEqual(actual, true);
        });

        it('should call \'jacocoGradleSingleModuleEnable\' if project is single-module', async () => {
            const actual = await jacocoGradleCodeCoverageEnablerInstance.enableCodeCoverage(
                {
                    buildfile: fakeData.buildFile,
                    classfilter: fakeData.classFilter,
                    classfilesdirectories: fakeData.classDir,
                    summaryfile: fakeData.summaryFile,
                    reportdirectory: fakeData.reportDir,
                    ismultimodule: 'false',
                    gradle5xOrHigher: 'true'
                });
            sandbox.assert.calledOnce(ccc.jacocoGradleSingleModuleEnable);
            assert.strictEqual(actual, true);
        });

        it('should write warning and reject promise in case of error', async () => {
            appendTextToFileSync.callsFake(() => { throw new Error('Some error has occurred') });
            assert.rejects(jacocoGradleCodeCoverageEnablerInstance.enableCodeCoverage(
                {
                    buildfile: fakeData.buildFile,
                    classfilter: fakeData.classFilter,
                    classfilesdirectories: fakeData.classDir,
                    summaryfile: fakeData.summaryFile,
                    reportdirectory: fakeData.reportDir,
                    ismultimodule: 'false',
                    gradle5xOrHigher: 'true'
                }), Error)
            sandbox.assert.calledOnce(tl.warning);
            appendTextToFileSync.callsFake();
        });
    })
}