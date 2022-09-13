import * as assert from 'assert';
import * as ccc from "../codecoverageconstants";
import * as expectedResults from "./data/expectedResults";
import * as fakeData from "./data/fakeData"
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "../utilities";

export function coberturagradleccenablerTests() {
    const sandbox = sinon.createSandbox();
    const coberturagradleenablerRewired = rewire('../cobertura/cobertura.gradle.ccenabler');
    const coberturaGradleCodeCoverageEnablerClass = coberturagradleenablerRewired.__get__('CoberturaGradleCodeCoverageEnabler')
    const coberturaGradleCodeCoverageEnablerInstance = new coberturaGradleCodeCoverageEnablerClass();

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
            const actual = coberturaGradleCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, []);
        });
    
        it('should return correct array of filters', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = coberturaGradleCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, expectedResults.coberturaGradleCorrectedAppliedFilterPatter);
        });
    });

    describe('function enableCodeCoverage', () => {
        let insertTextToFileSyncStub;

        before(() => {
            sandbox.stub(tl, "debug").callsFake();
            sandbox.stub(tl, "warning").callsFake();
            sandbox.stub(tl, "loc").callsFake();
            sandbox.stub(coberturaGradleCodeCoverageEnablerInstance, "extractFilters").returns(fakeData.filters);
            sandbox.stub(coberturaGradleCodeCoverageEnablerInstance, "applyFilterPattern")
                .onCall(0)
                .returns(fakeData.excludeFilter)
                .onCall(1)
                .returns(fakeData.includeFilter);
            sandbox.stub(ccc, "coberturaGradleMultiModuleEnable").returns('Multi-Module Configuration');
            sandbox.stub(ccc, "coberturaGradleSingleModuleEnable").returns('Single-MOdule Configuration');
            insertTextToFileSyncStub = sandbox.stub(util, "insertTextToFileSync").callsFake();
        });
    
        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            sandbox.resetHistory();
        })

        it('should call \'coberturaGradleMultiModuleEnable\' if project is multi-module', async () => {
            const actual = await coberturaGradleCodeCoverageEnablerInstance.enableCodeCoverage(
                {
                    buildfile: fakeData.buildFile,
                    classfilter: fakeData.classFilter,
                    classfilesdirectories: fakeData.classDir,
                    summaryfile: fakeData.summaryFile,
                    reportdirectory: fakeData.reportDir,
                    ismultimodule: 'true',
                    gradle5xOrHigher: 'true'
                });
            sandbox.assert.calledOnce(ccc.coberturaGradleMultiModuleEnable);
            assert.strictEqual(actual, true);
        });

        it('should call \'coberturaGradleSingleModuleEnable\' if project is single-module', async () => {
            const actual = await coberturaGradleCodeCoverageEnablerInstance.enableCodeCoverage(
                {
                    buildfile: fakeData.buildFile,
                    classfilter: fakeData.classFilter,
                    classfilesdirectories: fakeData.classDir,
                    summaryfile: fakeData.summaryFile,
                    reportdirectory: fakeData.reportDir,
                    ismultimodule: 'false',
                    gradle5xOrHigher: 'true'
                });
            sandbox.assert.calledOnce(ccc.coberturaGradleSingleModuleEnable);
            assert.strictEqual(actual, true);
        });

        it('should reject promise in case of error', async () => {
            insertTextToFileSyncStub.callsFake(() => { throw new Error('Some error has occurred') });
            assert.rejects(coberturaGradleCodeCoverageEnablerInstance.enableCodeCoverage(
                {
                    buildfile: fakeData.buildFile,
                    classfilter: fakeData.classFilter,
                    classfilesdirectories: fakeData.classDir,
                    summaryfile: fakeData.summaryFile,
                    reportdirectory: fakeData.reportDir,
                    ismultimodule: 'false',
                    gradle5xOrHigher: 'true'
                }), Error);
            insertTextToFileSyncStub.callsFake();
        });
    })
}