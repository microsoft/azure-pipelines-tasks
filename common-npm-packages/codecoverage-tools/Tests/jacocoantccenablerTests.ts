import * as assert from 'assert';
import * as ccc from "../codecoverageconstants";
import * as expectedResults from './data/expectedResults';
import * as fakeData from "./data/fakeData";
import * as Q from "q";
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as stubs from './data/stubs'
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "../utilities";

export function jacocoantccenablerTests() {
    const sandbox = sinon.createSandbox();
    const jacocoantccenablerRewired = rewire('../jacoco/jacoco.ant.ccenabler');
    const jacocoAntCodeCoverageEnablerClass = jacocoantccenablerRewired.__get__('JacocoAntCodeCoverageEnabler')
    const jacocoAntCodeCoverageEnablerInstance = new jacocoAntCodeCoverageEnablerClass();

    before(() => {
        // reset all fields of class to prevent unexpected behavior and to be able to stub them
        jacocoAntCodeCoverageEnablerInstance.reportDir = null;
        jacocoAntCodeCoverageEnablerInstance.excludeFilter = null;
        jacocoAntCodeCoverageEnablerInstance.includeFilter = null;
        jacocoAntCodeCoverageEnablerInstance.sourceDirs = null;
        jacocoAntCodeCoverageEnablerInstance.classDirs = null;
        jacocoAntCodeCoverageEnablerInstance.reportBuildFile = null;
        jacocoAntCodeCoverageEnablerInstance.excludeFilterExec = null;
        jacocoAntCodeCoverageEnablerInstance.includeFilterExec = null;
    });

    describe('function enableCodeCoverage', () => {
        let extractFiltersStub, excludeFilterExecStub, includeFilterExecStub, applyFilterPatternStub;

        before(() => {
            sandbox.stub(tl, "debug").callsFake();
            extractFiltersStub = sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'extractFilters').callsFake();
            excludeFilterExecStub = sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'excludeFilterExec');
            includeFilterExecStub = sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'includeFilterExec');
            applyFilterPatternStub = sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'applyFilterPattern').callsFake();
            sandbox.stub(util, 'readXmlFileAsJson').returns(Q.resolve(() => ({ node: {} })));
            sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'addCodeCoverageData').returns(Q.resolve(() => ([])));
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            extractFiltersStub.reset();
            excludeFilterExecStub.reset();
            includeFilterExecStub.reset();
            applyFilterPatternStub.reset();
        })

        it('should remove colon in excludeFilter and includeFilter', async () => {
            extractFiltersStub.returns({
                excludeFilter: ':excludeFilter',
                includeFilter: ':includeFilter'
            });
            applyFilterPatternStub.returns([]);
            await jacocoAntCodeCoverageEnablerInstance.enableCodeCoverage({
                reportDir: null,
                excludeFilter: null,
                includeFilter: null,
                sourceDirs: null,
                classDirs: null,
                reportBuildFile: null,
                excludeFilterExec: null,
                includeFilterExec: null
            });
            assert.strictEqual(jacocoAntCodeCoverageEnablerInstance.excludeFilterExec, 'excludeFilter');
            assert.strictEqual(jacocoAntCodeCoverageEnablerInstance.includeFilterExec, 'includeFilter');
        });

        it('should join result of applyFilterPattern function with comma', async () => {
            extractFiltersStub.returns({
                excludeFilter: 'excludeFilter',
                includeFilter: 'includeFilter'
            });
            applyFilterPatternStub
                .onFirstCall().returns(["first", "second"])
                .onSecondCall().returns(["third", "fourth"]);
            await jacocoAntCodeCoverageEnablerInstance.enableCodeCoverage({
                reportDir: null,
                excludeFilter: null,
                includeFilter: null,
                sourceDirs: null,
                classDirs: null,
                reportBuildFile: null,
                excludeFilterExec: null,
                includeFilterExec: null
            });
            assert.strictEqual(jacocoAntCodeCoverageEnablerInstance.excludeFilter, 'first,second');
            assert.strictEqual(jacocoAntCodeCoverageEnablerInstance.includeFilter, 'third,fourth');
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
            const actual = jacocoAntCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, []);
        });
    
        it('should return correct array of filters', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = jacocoAntCodeCoverageEnablerInstance.applyFilterPattern(fakeData.filtersWithNotAppliedFilterPattern);
            assert.deepStrictEqual(actual, expectedResults.jacocoAntCorrectedAppliedFilterPatter);
        });
    });

    describe('function getSourceFilter', () => {
        let isNullOrWhitespaceStub, sourceDirsStub;

        before(() => {
            isNullOrWhitespaceStub = sandbox.stub(util, "isNullOrWhitespace").callsFake();
            sourceDirsStub = sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'sourceDirs').value(null);
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            isNullOrWhitespaceStub.reset();
            sourceDirsStub.reset();
        });

        it('should return correct structure if sourceDirs is null', () => {
            isNullOrWhitespaceStub.returns(true);
            sourceDirsStub.value(null); 
            const actual =jacocoAntCodeCoverageEnablerInstance.getSourceFilter();
            assert.strictEqual(actual, expectedResults.getSourceFilterResultSourceDirsNull);
        });

        it('should return correct structure', () => {
            isNullOrWhitespaceStub.returns(false);
            sourceDirsStub.value(fakeData.sourceDirs);
            const actual =jacocoAntCodeCoverageEnablerInstance.getSourceFilter();
            assert.strictEqual(actual, expectedResults.getSourceFilterResult);
        });
    });

    describe('function addCodeCoverageData', () => {
        before(() => {
            sandbox.stub(tl, 'loc').callsFake(() => 'error');
            sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'getSourceFilter').callsFake();
            sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'getClassData').callsFake();
            sandbox.stub(ccc, 'jacocoAntReport').callsFake();
            sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'addCodeCoveragePluginData').resolves('addCodeCoveragePluginData result');
            sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'createReportFile').resolves('createReportFile result');
        });

        after(() => {
            sandbox.restore();
        });

        it('should reject if build configuration doesn\'t have project node', () => {
            assert.rejects(jacocoAntCodeCoverageEnablerInstance.addCodeCoverageData(fakeData.AntBuildConfigurationJSONWithoutProject));
        });

        it('should return array with coverage plugin data and report file', async () => {
            const actual = await jacocoAntCodeCoverageEnablerInstance.addCodeCoverageData(fakeData.AntBuildConfigurationJSONWithProject);
            assert.deepStrictEqual(actual, expectedResults.addCodeCoverageDataJacoco);
        });
    });

    describe('function addCodeCoverageNodes', () => {
        before(() => {
            sandbox.stub(tl, 'debug').callsFake();
            sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'enableForking').callsFake((obj) => { obj.enableForking = true });
        });

        after(() => {
            sandbox.restore();
        });

        it('should reject if project doesn\'t have target in build configuration', () => {
            assert.rejects(jacocoAntCodeCoverageEnablerInstance.addCodeCoverageNodes(fakeData.AntBuildConfigurationJSONWithProject));
        });

        it('should add correct append coverage node if target is string', async () => {
            const config = {
                project: {
                    target: 'some target'
                }
            }
            await jacocoAntCodeCoverageEnablerInstance.addCodeCoverageNodes(config);
            assert.deepStrictEqual(config, expectedResults.addCodeCoverageNodesTargetString);
        });

        it('should add correct append coverage node if target is array', async () => {
            const config = {
                project: {
                    target: [
                        {}, 
                        {}, 
                        {}
                    ]
                }
            }
            await jacocoAntCodeCoverageEnablerInstance.addCodeCoverageNodes(config);
            assert.deepStrictEqual(config, expectedResults.addCodeCoverageNodesTargetArray);
        });
    });

    describe('function enableForking', () => {
        let isNullOrWhitespaceStub, excludeFilterExecStub, includeFilterExecStub;

        before(() => {
            isNullOrWhitespaceStub = sandbox.stub(util, "isNullOrWhitespace").callsFake();
            sandbox.stub(ccc, 'jacocoAntCoverageEnable').callsFake(stubs.jacocoAntCoverageEnableOutput);
            sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'enableForkOnTestNodes').callsFake((node, _) => { node.enableForkOnTestNodes = true });
            excludeFilterExecStub = sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'excludeFilterExec');
            includeFilterExecStub = sandbox.stub(jacocoAntCodeCoverageEnablerInstance, 'includeFilterExec');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            isNullOrWhitespaceStub.reset();
            excludeFilterExecStub.restore();
            includeFilterExecStub.restore();
        });

        it('should return configuration without includeFilter and excludeFilter', () => {
            isNullOrWhitespaceStub.returns(true);
            const config = {
                junit: {}
            };
            jacocoAntCodeCoverageEnablerInstance.enableForking(config);
            assert.deepStrictEqual(config, expectedResults.enableForkingWithoutFilters);
        });

        it('should return configuration with include filter', () => {
            isNullOrWhitespaceStub
                .onCall(0).returns(false)
                .returns(true);
            includeFilterExecStub.value(fakeData.includeFilter);
            const config = {
                junit: {}
            };
            jacocoAntCodeCoverageEnablerInstance.enableForking(config);
            assert.deepStrictEqual(config, expectedResults.enableForkingWithIncludingFilter);
        });

        it('should return configuration with exclude filter', () => {
            isNullOrWhitespaceStub
                .onCall(1).returns(false)
                .returns(true);
            excludeFilterExecStub.value(fakeData.excludeFilter);
            const config = {
                junit: {}
            };
            jacocoAntCodeCoverageEnablerInstance.enableForking(config);
            assert.deepStrictEqual(config, expectedResults.enableForkingWithExcludingFilter);
        });
    });

    describe('function enableForkOnTestNodes', () => {
        it('should enable fork correctly with enabled Fork Mode when node \'$\' doesn\'t exist', () => {
            const testNode = {};
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, true);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesNotArrayWithForkModeEnabled);
        });

        it('should enable fork correctly with enabled Fork Mode when node \'$\' exists', () => {
            const testNode = { $: {} };
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, true);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesNotArrayWithForkModeEnabled);
        });

        it('should enable fork correctly with disabled Fork Mode when node \'$\' doesn\'t exist', () => {
            const testNode = {};
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, false);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesNotArrayWithForkModeDisabled);
        });
        
        it('should enable fork correctly with disabled Fork Mode when node \'$\' exists', () => {
            const testNode = { $: {} };
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, false);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesNotArrayWithForkModeDisabled);
        });

        it('should enable fork correctly for array with enabled Fork Mode when node \'$\' doesn\'t exist', () => {
            const testNode = [
                {
                    element: 'first'
                },
                {
                    element: 'second'
                }
            ];
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, true);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesArrayWithForkModeEnabled);
        });

        it('should enable fork correctly for array with enabled Fork Mode when node \'$\' exists', () => {
            const testNode = [
                {
                    element: 'first',
                    $: {}
                },
                {
                    element: 'second',
                    $: {}
                }
            ];
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, true);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesArrayWithForkModeEnabled);
        });

        it('should enable fork correctly for array with disabled Fork Mode when node \'$\' doesn\'t exist', () => {
            const testNode = [
                {
                    element: 'first',
                },
                {
                    element: 'second',
                }
            ];
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, false);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesArrayWithForkModeDisabled);
        });
        
        it('should enable fork correctly for array with disabled Fork Mode when node \'$\' exists', () => {
            const testNode = [
                {
                    element: 'first',
                    $: {}
                },
                {
                    element: 'second',
                    $: {}
                }
            ];
            jacocoAntCodeCoverageEnablerInstance.enableForkOnTestNodes(testNode, false);
            assert.deepStrictEqual(testNode, expectedResults.enableForkOnTestNodesArrayWithForkModeDisabled);
        });
    });
}