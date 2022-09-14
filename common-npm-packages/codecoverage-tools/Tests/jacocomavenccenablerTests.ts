import * as assert from 'assert';
import * as ccc from "../codecoverageconstants";
import * as expectedResults from "./data/expectedResults";
import * as fakeData from "./data/fakeData"
import * as Q from "q";
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "../utilities";

export function jacocomavenccenablerTests() {
    const sandbox = sinon.createSandbox();
    const jacocomavenenablerRewired = rewire('../jacoco/jacoco.maven.ccenabler');
    const jacocoMavenCodeCoverageEnablerClass = jacocomavenenablerRewired.__get__('JacocoMavenCodeCoverageEnabler')
    const jacocoMavenCodeCoverageEnablerInstance = new jacocoMavenCodeCoverageEnablerClass();
    
    before(() => {
        jacocoMavenCodeCoverageEnablerInstance.classDirs = null;
        jacocoMavenCodeCoverageEnablerInstance.excludeFilter = null;
        jacocoMavenCodeCoverageEnablerInstance.includeFilter = null;
        jacocoMavenCodeCoverageEnablerInstance.reportBuildFile = null;
        jacocoMavenCodeCoverageEnablerInstance.reportDir = null;
        jacocoMavenCodeCoverageEnablerInstance.sourceDirs = null;
    });
    
    after(() => {
        sandbox.restore();
    });
    
    describe('function enableCodeCoverage', () => {
        let extractFiltersStub, applyFilterPatternStub, readXmlFileAsJsonStub;
        
        before(() => {
            sandbox.stub(tl, 'debug').callsFake();
            extractFiltersStub = sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'extractFilters').callsFake(function () { return fakeData.filters });
            applyFilterPatternStub = sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'applyFilterPattern').callsFake();
            sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'addCodeCoverageData').returns(Q.resolve());
            readXmlFileAsJsonStub = sandbox.stub(util, 'readXmlFileAsJson').returns(Q.resolve());
        });
        
        afterEach(() => {
            extractFiltersStub.resetHistory();
            applyFilterPatternStub.resetHistory();
            readXmlFileAsJsonStub.resetHistory();
        });
        
        after(() => {
            sandbox.restore();
        });
        
        it('should call correct functions', async () => {
            await jacocoMavenCodeCoverageEnablerInstance.enableCodeCoverage({
                buildfile: fakeData.buildFile,
                reportdirectory: fakeData.reportDir,
                sourcedirectories: fakeData.sourceDirs,
                classfilesdirectories: fakeData.classDirs,
                reportbuildfile: fakeData.reportBuildFile,
                classfilter: fakeData.classFilter,
            });
            sinon.assert.calledOnceWithExactly(extractFiltersStub, fakeData.classFilter);
            sinon.assert.calledWithExactly(applyFilterPatternStub, fakeData.filters.includeFilter);
            sinon.assert.calledWithExactly(applyFilterPatternStub, fakeData.filters.excludeFilter);
            sinon.assert.calledOnceWithExactly(readXmlFileAsJsonStub, fakeData.buildFile);
        });
    });
    
    describe('function applyFilterPattern', () => {
        let isNullOrWhitespaceStub;

        before(() => {
            sandbox.stub(tl, 'debug');
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
            const actual = jacocoMavenCodeCoverageEnablerInstance.applyFilterPattern("");
            assert.deepStrictEqual(actual, []);
        });
    
        it('should return correct array of filters', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = jacocoMavenCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, expectedResults.jacocoMavenCorrectedAppliedFilterPatter);
        });
    });
    
    describe('function addCodeCoverageData', () => {
        before(() => {
            sandbox.stub(tl, 'debug');
            sandbox.stub(tl, 'loc');
            sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'addCodeCoveragePluginData').resolves("addCodeCoveragePluginData");
            sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'createMultiModuleReport').resolves("createMultiModuleReport");
        });
        
        after(() => {
            sandbox.restore();
        });
        
        it('should reject if there is no project node in build configuration', () => {
            assert.rejects(jacocoMavenCodeCoverageEnablerInstance.addCodeCoverageData(fakeData.addCodeCoverageDataPomJsonWithoutProject));
        });
        
        it('should return correct value if project is single-module', async () => {
            const actual = await jacocoMavenCodeCoverageEnablerInstance.addCodeCoverageData(fakeData.addCodeCoverageDataPomJsonSingle);
            assert.deepStrictEqual(actual, expectedResults.addCodeCoverageDataSingleProject);
        });
        
        it('should return correct value if project is multi-module', async () => {
            const actual = await jacocoMavenCodeCoverageEnablerInstance.addCodeCoverageData(fakeData.addCodeCoverageDataPomJsonMulti);
            assert.deepStrictEqual(actual, expectedResults.addCodeCoverageDataMultiProject);
        });
    });
    
    describe('function getBuildDataNode', () => {
        it('should return correct build node and correct build configuration if build node is string', () => {
            const config = fakeData.getBuildDataNodeBuildJsonContentBuildString();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getBuildDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getBuildDataNodeBuildString);
            assert.deepStrictEqual(config, expectedResults.getBuildDataNodeBuildJsonContentBuildString);
        });
        
        it('should return correct build node if build node is array', () => {
            const config = fakeData.getBuildDataNodeBuildJsonContentBuildArray();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getBuildDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getBuildDataNodeBuildArray);
            assert.deepStrictEqual(config, expectedResults.getBuildDataNodeBuildJsonContentBuildArray);
        });
        
        it('should return correct build node and correct build configuration if build node is array with string element', () => {
            const config = fakeData.getBuildDataNodeBuildJsonContentBuildArrayWithStringElement();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getBuildDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getBuildDataNodeBuildArrayWithStringElement);
            assert.deepStrictEqual(config, expectedResults.getBuildDataNodeBuildJsonContentBuildArrayWithStringElement);
        });
    });
    
    describe('function getPluginDataNode ', () => {
        it('should return correct plugin data node if there is no plugin data node', () => {
            const config = fakeData.getPluginDataNodeWithoutPluginsNode();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodeWithoutPluginsNode);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodeWithoutPluginsNodeConfig);
        });
        
        it('should return correct plugin data node if there is plugin node with string value', () => {
            const config = fakeData.getPluginDataNodePluginsString();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsString);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsStringConfig);
        });
        
        it('should return correct plugin data node if there is plugin node with string array', () => {
            const config = fakeData.getPluginDataNodePluginsStringArray();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsStringArray);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsStringArrayConfig);
        });
        
        it('should return correct plugin data node if there is plugin node with array', () => {
            const config = fakeData.getPluginDataNodePluginsArray();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsArray);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsArrayConfig);
        });
        
        it('should return correct plugin data node if there is plugin node contains object', () => {
            const config = fakeData.getPluginDataNodePluginsAnother();
            const actual = jacocoMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsAnother);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsAnotherConfig);
        });
    });
    
    describe('function createMultiModuleReport', () => {
        let sourceDirsStub, classDirsStub, includeFilterStub, excludeFilterStub, isNullOrWhitespaceStub, jacocoMavenMultiModuleReportStub;
        
        before(() => {
            sourceDirsStub = sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'sourceDirs');
            classDirsStub = sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'classDirs');
            includeFilterStub = sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'includeFilter');
            excludeFilterStub = sandbox.stub(jacocoMavenCodeCoverageEnablerInstance, 'excludeFilter');
            isNullOrWhitespaceStub = sandbox.stub(util, 'isNullOrWhitespace');
            sandbox.stub(util, 'writeFile').resolves();
            jacocoMavenMultiModuleReportStub = sandbox.stub(ccc, 'jacocoMavenMultiModuleReport').resolves();
        });
        
        afterEach(() => {
            sourceDirsStub.restore();
            classDirsStub.restore();
            includeFilterStub.restore();
            excludeFilterStub.restore();
            isNullOrWhitespaceStub.reset();
            jacocoMavenMultiModuleReportStub.resetHistory();
        });
        
        after(() => {
            sandbox.restore();
        });
        
        it('should join filters and set srcDirs and classDirs if they are null', async () => {
            isNullOrWhitespaceStub.returns(true);
            includeFilterStub.value(fakeData.includeFilter);
            excludeFilterStub.value(fakeData.excludeFilter);
            sourceDirsStub.value(fakeData.sourceDir);
            classDirsStub.value(fakeData.classDir);
            await jacocoMavenCodeCoverageEnablerInstance.createMultiModuleReport(fakeData.reportDir);
            sinon.assert.calledOnceWithExactly(
                jacocoMavenMultiModuleReportStub,
                fakeData.reportDir,
                ".",
                ".",
                fakeData.includeFilterStringifiedWithComma,
                fakeData.excludeFilterStringifiedWithComma
            );
        });
        
        it('should join filters and shouldn\'t set srcDirs and classDirs if they are not null', async () => {
            isNullOrWhitespaceStub.returns(false);
            includeFilterStub.value(fakeData.includeFilter);
            excludeFilterStub.value(fakeData.excludeFilter);
            sourceDirsStub.value(fakeData.sourceDir);
            classDirsStub.value(fakeData.classDir);
            await jacocoMavenCodeCoverageEnablerInstance.createMultiModuleReport(fakeData.reportDir);
            sinon.assert.calledOnceWithExactly(
                jacocoMavenMultiModuleReportStub,
                fakeData.reportDir,
                fakeData.sourceDir,
                fakeData.classDir,
                fakeData.includeFilterStringifiedWithComma,
                fakeData.excludeFilterStringifiedWithComma
            );
        });
    });
}