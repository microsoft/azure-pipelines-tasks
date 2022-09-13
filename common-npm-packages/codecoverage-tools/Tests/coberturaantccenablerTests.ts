import * as assert from 'assert';
import * as ccc from "../codecoverageconstants";
import * as expectedResults from './data/expectedResults';
import * as fakeData from "./data/fakeData";
import * as path from "path";
import * as Q from "q";
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as stubs from './data/stubs'
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "../utilities";

export function coberturaantccenablerTests() {
    const sandbox = sinon.createSandbox();
    const coberturaantccenablerRewired = rewire('../cobertura/cobertura.ant.ccenabler');
    const coberturaAntCodeCoverageEnablerClass = coberturaantccenablerRewired.__get__('CoberturaAntCodeCoverageEnabler')
    const coberturaAntCodeCoverageEnablerInstance = new coberturaAntCodeCoverageEnablerClass();

    before(() => {
        // reset all fields of class to be able to stub them
        coberturaAntCodeCoverageEnablerInstance.reportDir = null;
        coberturaAntCodeCoverageEnablerInstance.reportbuildfile = null;
        coberturaAntCodeCoverageEnablerInstance.classDirs = null;
        coberturaAntCodeCoverageEnablerInstance.includeFilter = null;
        coberturaAntCodeCoverageEnablerInstance.excludeFilter = null;
        coberturaAntCodeCoverageEnablerInstance.sourceDirs = null;
    });

    after(() => {
        sandbox.restore();
    });

    describe('function enableCodeCoverage', () => {
        let extractFiltersStub, applyFilterPatternStub, isNullOrWhitespaceStub;

        before(() => {
            sandbox.stub(tl, "debug").callsFake();
            sandbox.stub(tl, "setResourcePath").callsFake();
            extractFiltersStub = sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'extractFilters').callsFake();
            applyFilterPatternStub = sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'applyFilterPattern').callsFake();
            sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'addCodeCoverageData').returns(Q.resolve(() => ([])));
            sandbox.stub(util, 'readXmlFileAsDom').callsFake();
            isNullOrWhitespaceStub = sandbox.stub(util, 'isNullOrWhitespace');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            extractFiltersStub.reset();
            applyFilterPatternStub.reset();
            isNullOrWhitespaceStub.reset();
        })

        it('should set sourceDirs as \'.\' in case it\'s not specified', async () => {
            isNullOrWhitespaceStub.returns(true);
            extractFiltersStub.returns({
                excludeFilter: 'excludeFilter',
                includeFilter: 'includeFilter'
            });
            applyFilterPatternStub.returns([]);
            await coberturaAntCodeCoverageEnablerInstance.enableCodeCoverage({
                buildfile: null,
                classfilter: null,
                sourcedirectories: null,
                classfilesdirectories: null
            });
            assert.strictEqual(coberturaAntCodeCoverageEnablerInstance.sourceDirs, '.');
        });

        it('should join result of applyFilterPattern function with comma', async () => {
            isNullOrWhitespaceStub.returns(false);
            extractFiltersStub.returns({
                excludeFilter: 'excludeFilter',
                includeFilter: 'includeFilter'
            });
            applyFilterPatternStub
                .onFirstCall().returns(["first", "second"])
                .onSecondCall().returns(["third", "fourth"]);
            await coberturaAntCodeCoverageEnablerInstance.enableCodeCoverage({
                buildfile: null,
                classfilter: null,
                sourcedirectories: null,
                classfilesdirectories: null
            });
            assert.strictEqual(coberturaAntCodeCoverageEnablerInstance.excludeFilter, 'first,second');
            assert.strictEqual(coberturaAntCodeCoverageEnablerInstance.includeFilter, 'third,fourth');
        });
    });

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
            const actual = coberturaAntCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, []);
        });
    
        it('should return correct array of filters', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = coberturaAntCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, expectedResults.coberturaAntCorrectedAppliedFilterPatter);
        });
    });

    describe('function getClassData', () => {
        let classDirsStub, isNullOrWhitespaceStub;

        before(() => {
            classDirsStub = sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'classDirs').value(fakeData.classDirs);
            sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'includeFilter').value(fakeData.includeFilterStringified);
            sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'excludeFilter').value(fakeData.excludeFilterStringified);
            isNullOrWhitespaceStub = sandbox.stub(util, 'isNullOrWhitespace');
        });

        afterEach(() => {
            isNullOrWhitespaceStub.reset();
        });

        it('should return correct structure', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = coberturaAntCodeCoverageEnablerInstance.getClassData();
            assert.strictEqual(actual, expectedResults.getClassDataResult)
        });

        it('should set classDirs as \'.\' in case it\'s null', () => {
            isNullOrWhitespaceStub.returns(true);
            const actual = coberturaAntCodeCoverageEnablerInstance.getClassData();
            assert.strictEqual(actual, expectedResults.getClassDataResultWhenClassDirsEmpty)
        });
    });

    describe('function addCodeCoverageData', () => {
        before(() => {
            sandbox.stub(tl, 'loc').callsFake(() => 'error');
            sandbox.stub(ccc, 'coberturaAntReport').callsFake();
            sandbox.stub(path, 'join').callsFake();
            sandbox.stub(path, 'dirname').callsFake();
            sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'addCodeCoverageNodes').resolves('addCodeCoverageNodes result');
            sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'createReportFile').resolves('createReportFile result');
        });

        after(() => {
            sandbox.restore();
        });

        it('should reject if build configuration is null', () => {
            assert.rejects(coberturaAntCodeCoverageEnablerInstance.addCodeCoverageData(null));
        });
        
        it('should reject if build configuration doesn\'t have project node', () => {
            assert.rejects(coberturaAntCodeCoverageEnablerInstance.addCodeCoverageData(fakeData.cherioObjWithoutProjectNode));
        });

        it('should return array with coverage plugin data and report file', async () => {
            const actual = await coberturaAntCodeCoverageEnablerInstance.addCodeCoverageData(fakeData.cherioObjWithProjectNode);
            assert.deepStrictEqual(actual, expectedResults.addCodeCoverageDataCobertura);
        });
    });

    describe('function addCodeCoverageNodes', () => {
        let enableForkingStub;
        
        before(() => {
            sandbox.stub(tl, 'debug').callsFake();
            sandbox.stub(tl, 'loc').callsFake();
            sandbox.stub(ccc, 'coberturaAntCoverageEnable').returns('\n    <coberturaAntCoverageEnable/>');
            enableForkingStub = sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'enableForking').callsFake();
            sandbox.stub(util, 'writeFile').callsFake();
        });
        
        after(() => {
            sandbox.restore();
        });

        it('should reject if project doesn\'t have target in build configuration', () => {
            assert.rejects(coberturaAntCodeCoverageEnablerInstance.addCodeCoverageNodes(fakeData.cherioObjWithProjectNode));
        });
        
        it('should prepend project with a configuration and enable forking for each target', async () => {
            const config = fakeData.coberturaAntBuildConfigurationWithTarget;
            await coberturaAntCodeCoverageEnablerInstance.addCodeCoverageNodes(config);
            assert.deepStrictEqual(config.xml(), expectedResults.addCodeCoverageNodesCoberturaResult);
            sinon.assert.callCount(enableForkingStub, 3);
            enableForkingStub.resetHistory();
        });
    });

    describe('function enableForking', () => {
        before(() => {
            sandbox.stub(path, 'dirname').callsFake();
            sandbox.stub(path, 'join').callsFake();
            sandbox.stub(ccc, 'coberturaAntProperties').returns(stubs.coberturaAntPropertiesConfiguration);
            sandbox.stub(ccc, 'coberturaAntInstrumentedClasses').returns(stubs.coberturaAntInstrumentedClassesConfiguration);
            sandbox.stub(ccc, 'coberturaAntClasspathRef').returns(stubs.coberturaAntClasspathRefConfiguration);
            sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'getClassData').callsFake();
            sandbox.stub(coberturaAntCodeCoverageEnablerInstance, 'enableForkOnTestNodes').callsFake();
        });

        after(() => {
            sandbox.restore();
        });

        it('should return correct configuration if there is no node \'cobertura-instrument\'', () => {
            const config = fakeData.enableForkingBuildConfigWithTargetConfig;
            const targetNode = fakeData.enableForkingBuildConfigWithTargetNode;
            coberturaAntCodeCoverageEnablerInstance.enableForking(config, targetNode);
            assert.deepStrictEqual(config.xml(), expectedResults.enableForkingWithoutCoberturaInstrument);
        });
        
        it('should return correct configuration if there is node \'cobertura-instrument\'', () => {
            const config = fakeData.enableForkingBuildConfigWithTargetAndCoberturaConfig;
            const targetNode = fakeData.enableForkingBuildConfigWithTargetAndCoberturaNode;
            coberturaAntCodeCoverageEnablerInstance.enableForking(config, targetNode);
            assert.deepStrictEqual(config.xml(), expectedResults.enableForkingWithCoberturaInstrument);
        });
        
        it('shouldn\'t add anything if there is no at least one target', () => {
            const config = fakeData.enableForkingBuildConfigWithoutTargetConfig;
            const targetNode = fakeData.enableForkingBuildConfigWithoutTargetNode;
            coberturaAntCodeCoverageEnablerInstance.enableForking(config, targetNode);
            assert.deepStrictEqual(config.xml(), expectedResults.enableForkingWithoutTarget);
        });
        
        it('should add \'debug\' attribute to \'javac\' if it exists', () => {
            const config = fakeData.enableForkingBuildConfigWithJavacConfig;
            const targetNode = fakeData.enableForkingBuildConfigWithJavacNode;
            coberturaAntCodeCoverageEnablerInstance.enableForking(config, targetNode);
            assert.deepStrictEqual(config.xml(), expectedResults.enableForkingWithJavac);
        });
    });

    describe('function enableForkOnTestNodes', () => {
        it('should enable fork on specified note', () => {
            const node = fakeData.nodeToEnableFork;
            coberturaAntCodeCoverageEnablerInstance.enableForkOnTestNodes(node);
            assert.strictEqual(node.attribs['fork'], 'true');
            assert.strictEqual(node.attribs['forkmode'], 'once');
        })
    });
}