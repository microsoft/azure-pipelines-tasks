import * as assert from 'assert';
import * as expectedResults from "./data/expectedResults";
import * as fakeData from "./data/fakeData";
import * as Q from "q";
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "../utilities";

export function coberturamavenccenablerTests() {
    const sandbox = sinon.createSandbox();
    const coberturamavenenablerRewired = rewire('../cobertura/cobertura.maven.ccenabler');
    const coberturaMavenCodeCoverageEnablerClass = coberturamavenenablerRewired.__get__('CoberturaMavenCodeCoverageEnabler')
    const coberturaMavenCodeCoverageEnablerInstance = new coberturaMavenCodeCoverageEnablerClass();

    before(() => {
        coberturaMavenCodeCoverageEnablerInstance.includeFilter = null;
        coberturaMavenCodeCoverageEnablerInstance.excludeFilter = null;
    });
    
    after(() => {
        sandbox.restore();
    });
    
    describe('function enableCodeCoverage', () => {
        let extractFiltersStub, applyFilterPatternStub, readXmlFileAsJsonStub
        
        before(() => {
            sandbox.stub(tl, 'debug');
            extractFiltersStub = sandbox.stub(coberturaMavenCodeCoverageEnablerInstance, 'extractFilters').returns(fakeData.filters);
            applyFilterPatternStub = sandbox.stub(coberturaMavenCodeCoverageEnablerInstance, 'applyFilterPattern').callsFake();
            sandbox.stub(coberturaMavenCodeCoverageEnablerInstance, 'addCodeCoveragePluginData').returns(Q.resolve());
            readXmlFileAsJsonStub = sandbox.stub(util, 'readXmlFileAsJson').returns(Q.resolve());
        });
        
        afterEach(() => {
            applyFilterPatternStub.reset();
            readXmlFileAsJsonStub.reset();
        });
        
        after(() => {
            sandbox.restore();
            coberturaMavenCodeCoverageEnablerInstance.includeFilter = null;
            coberturaMavenCodeCoverageEnablerInstance.excludeFilter = null;
        });
        
        it('should join filters and call correct functions', async () => {
            applyFilterPatternStub
                .onFirstCall().returns(fakeData.excludeFilter)
                .onSecondCall().returns(fakeData.includeFilter);
            await coberturaMavenCodeCoverageEnablerInstance.enableCodeCoverage({
                buildfile: fakeData.buildFile,
                classfilter: fakeData.classFilter
            });
            assert.strictEqual(coberturaMavenCodeCoverageEnablerInstance.includeFilter, fakeData.includeFilterStringifiedWithComma);
            assert.strictEqual(coberturaMavenCodeCoverageEnablerInstance.excludeFilter, fakeData.excludeFilterStringifiedWithComma);
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
            const actual = coberturaMavenCodeCoverageEnablerInstance.applyFilterPattern("");
            assert.deepStrictEqual(actual, []);
        });
    
        it('should return correct array of filters', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = coberturaMavenCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, expectedResults.coberturaMavenCorrectedAppliedFilterPatter);
        });
    });
    
    describe('function getBuildDataNode', () => {
        it('should return correct build node and correct build configuration if build node is string', () => {
            const config = fakeData.getBuildDataNodeBuildJsonContentBuildString();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getBuildDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getBuildDataNodeBuildString);
            assert.deepStrictEqual(config, expectedResults.getBuildDataNodeBuildJsonContentBuildString);
        });
        
        it('should return correct build node if build node is array', () => {
            const config = fakeData.getBuildDataNodeBuildJsonContentBuildArray();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getBuildDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getBuildDataNodeBuildArray);
            assert.deepStrictEqual(config, expectedResults.getBuildDataNodeBuildJsonContentBuildArray);
        });
        
        it('should return correct build node and correct build configuration if build node is array with string element', () => {
            const config = fakeData.getBuildDataNodeBuildJsonContentBuildArrayWithStringElement();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getBuildDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getBuildDataNodeBuildArrayWithStringElement);
            assert.deepStrictEqual(config, expectedResults.getBuildDataNodeBuildJsonContentBuildArrayWithStringElement);
        });
    });
    
    describe('function getPluginDataNode ', () => {
        it('should return correct plugin data node if there is no plugin data node', () => {
            const config = fakeData.getPluginDataNodeWithoutPluginsNode();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodeWithoutPluginsNode);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodeWithoutPluginsNodeConfig);
        });
        
        it('should return correct plugin data node if there is plugin node with string value', () => {
            const config = fakeData.getPluginDataNodePluginsString();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsString);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsStringConfig);
        });
        
        it('should return correct plugin data node if there is plugin node with string array', () => {
            const config = fakeData.getPluginDataNodePluginsStringArray();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsStringArray);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsStringArrayConfig);
        });
        
        it('should return correct plugin data node if there is plugin node with array', () => {
            const config = fakeData.getPluginDataNodePluginsArray();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsArray);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsArrayConfig);
        });
        
        it('should return correct plugin data node if there is plugin node contains object', () => {
            const config = fakeData.getPluginDataNodePluginsAnother();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getPluginDataNode(config);
            assert.deepStrictEqual(actual, expectedResults.getPluginDataNodePluginsAnother);
            assert.deepStrictEqual(config, expectedResults.getPluginDataNodePluginsAnotherConfig);
        });
    });
    
    describe('function getReportingPluginNode', () => {
        it('should return null if reportNode is null', () => {
            const config = null;
            const actual = coberturaMavenCodeCoverageEnablerInstance.getReportingPluginNode(config);
            assert.deepStrictEqual(actual, undefined);
        });
        
        it('should return null if reportNode is string', () => {
            const config = fakeData.getReportingPluginNodeString();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getReportingPluginNode(config);
            assert.deepStrictEqual(actual, undefined);
        });
        
        it('should return correct plugin node if reportNode is array', () => {
            const config = fakeData.getReportingPluginNodeArray();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getReportingPluginNode(config);
            assert.deepStrictEqual(actual, expectedResults.getReportingPluginNodeArray);
        });
        
        it('should return correct plugin node if reportNode is an object', () => {
            const config = fakeData.getReportingPluginNodeAnother();
            const actual = coberturaMavenCodeCoverageEnablerInstance.getReportingPluginNode(config);
            assert.deepStrictEqual(actual, expectedResults.getReportingPluginNodeAnother);
        });
    });
}