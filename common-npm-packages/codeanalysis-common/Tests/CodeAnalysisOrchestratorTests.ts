import * as assert from 'assert';
import * as path from 'path';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';

import { AnalysisResult } from '../Common/AnalysisResult';
import { IAnalysisTool } from '../Common/IAnalysisTool';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { CodeAnalysisResultPublisher } from '../Common/CodeAnalysisResultPublisher';

export function CodeAnalysisOrchestratorTests() {
    const sandbox = sinon.createSandbox();
    const codeAnalysisOrchestratorRewired = rewire('../Common/CodeAnalysisOrchestrator');
    const codeAnalysisOrchestratorClass = codeAnalysisOrchestratorRewired.__get__('CodeAnalysisOrchestrator');
    const codeAnalysisOrchestratorInstance = new codeAnalysisOrchestratorClass();

    describe('function \'configureBuild\'', () => {
        let toolsStub;
        let checkBuildContextStub;

        before(() => {
            toolsStub = sandbox.stub(codeAnalysisOrchestratorInstance, 'tools');
            checkBuildContextStub = sandbox.stub(codeAnalysisOrchestratorInstance, 'checkBuildContext');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            toolsStub.reset();
            checkBuildContextStub.reset();
        });

        it('should call \'configureBuild\' for each tool', () => {
            const tool1 = getAnalysisTool('tool-1');
            const tool2 = getAnalysisTool('tool-2');
            const tool3 = getAnalysisTool('tool-3');
            const toolRunner = {someField: 'some-value'};
            const configureBuild1Stub = sinon.stub(tool1, 'configureBuild').callsFake((value) => value);
            const configureBuild2Stub = sinon.stub(tool2, 'configureBuild').callsFake((value) => value);
            const configureBuild3Stub = sinon.stub(tool3, 'configureBuild').callsFake((value) => value);
            toolsStub.value([tool1, tool2, tool3]);
            checkBuildContextStub.returns(true);

            codeAnalysisOrchestratorInstance.configureBuild(toolRunner);

            sinon.assert.calledOnceWithExactly(configureBuild1Stub, toolRunner);
            sinon.assert.calledOnceWithExactly(configureBuild2Stub, toolRunner);
            sinon.assert.calledOnceWithExactly(configureBuild3Stub, toolRunner);
        });

        it('should return tool runner and not call \'configureBuild\'', () => {
            const tool1 = getAnalysisTool('tool-1');
            const tool2 = getAnalysisTool('tool-2');
            const tool3 = getAnalysisTool('tool-3');
            const toolRunner = {someField: 'some-value'};
            const configureBuild1Stub = sinon.stub(tool1, 'configureBuild').callsFake((value) => value);
            const configureBuild2Stub = sinon.stub(tool2, 'configureBuild').callsFake((value) => value);
            const configureBuild3Stub = sinon.stub(tool3, 'configureBuild').callsFake((value) => value);
            toolsStub.value([tool1, tool2, tool3]);
            checkBuildContextStub.returns(false);

            const actual = codeAnalysisOrchestratorInstance.configureBuild(toolRunner);
            assert.deepStrictEqual(actual, toolRunner);
            sinon.assert.notCalled(configureBuild1Stub);
            sinon.assert.notCalled(configureBuild2Stub);
            sinon.assert.notCalled(configureBuild3Stub);
        });
    });

    describe('function \'publishCodeAnalysisResults\'', () => {
        let joinStub;
        let checkBuildContextStub;
        let processResultsStub;
        let toolsStub;
        let uploadArtifactsStub;
        let uploadBuildSummaryStub;

        before(() => {
            sandbox.stub(tl, 'debug');
            sandbox.stub(tl, 'getVariable');
            joinStub = sandbox.stub(path, 'join');
            checkBuildContextStub = sandbox.stub(codeAnalysisOrchestratorInstance, 'checkBuildContext');
            processResultsStub = sandbox.stub(codeAnalysisOrchestratorInstance, 'processResults');
            toolsStub = sandbox.stub(codeAnalysisOrchestratorInstance, 'tools');
            uploadArtifactsStub = sandbox.stub(CodeAnalysisResultPublisher.prototype, 'uploadArtifacts');
            uploadBuildSummaryStub = sandbox.stub(CodeAnalysisResultPublisher.prototype, 'uploadBuildSummary');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            joinStub.reset();
            checkBuildContextStub.reset();
            processResultsStub.reset();
            toolsStub.reset();
            uploadArtifactsStub.reset();
            uploadBuildSummaryStub.reset();
        });

        it('should not call \'uploadArtifactsStub\' and \'uploadBuildSummary\' if checkBuildContext returns false', () => {
            checkBuildContextStub.returns(false);
            toolsStub.value([getAnalysisTool('tool-1')]);

            codeAnalysisOrchestratorInstance.publishCodeAnalysisResults();
            sinon.assert.notCalled(uploadArtifactsStub);
            sinon.assert.notCalled(uploadBuildSummaryStub);
        });

        it('should not call \'uploadArtifactsStub\' and \'uploadBuildSummary\' if tools array is empty', () => {
            checkBuildContextStub.returns(true);
            toolsStub.value([]);

            codeAnalysisOrchestratorInstance.publishCodeAnalysisResults();
            sinon.assert.notCalled(uploadArtifactsStub);
            sinon.assert.notCalled(uploadBuildSummaryStub);
        });

        it('should not call \'uploadArtifactsStub\' and \'uploadBuildSummary\' if there are no analysis results', () => {
            checkBuildContextStub.returns(true);
            toolsStub.value([getAnalysisTool('tool-1')]);
            processResultsStub.returns([]);

            codeAnalysisOrchestratorInstance.publishCodeAnalysisResults();
            sinon.assert.notCalled(uploadArtifactsStub);
            sinon.assert.notCalled(uploadBuildSummaryStub);
        });

        it('should call \'uploadArtifactsStub\' and \'uploadBuildSummary\'', () => {
            checkBuildContextStub.returns(true);
            toolsStub.value([getAnalysisTool('tool-1')]);
            processResultsStub.returns([
                {
                    affectedFileCount: 2,
                    moduleName: 'module-1',
                    originatingTool: null,
                    resultFiles: [],
                    violationCount: 2
                },
                {
                    affectedFileCount: 2,
                    moduleName: 'module-2',
                    originatingTool: null,
                    resultFiles: [],
                    violationCount: 2
                }
            ]);
            joinStub.returns('staging/dir');

            codeAnalysisOrchestratorInstance.publishCodeAnalysisResults();
            sinon.assert.calledOnce(uploadArtifactsStub);
            sinon.assert.calledOnce(uploadBuildSummaryStub);
        });
    });

    describe('function \'processResults\'', () => {
        after(() => {
            sandbox.restore();
        });

        it('should call \'processResults\' for each tool and return 3 analysis results', () => {
            const tool1 = getAnalysisTool('tool-1');
            const tool2 = getAnalysisTool('tool-2');
            const tool3 = getAnalysisTool('tool-3');
            const analysisResult = {
                affectedFileCount: 2,
                moduleName: 'module-1',
                originatingTool: null,
                resultFiles: [],
                violationCount: 2
            };
            const processResults1Stub = sinon.stub(tool1, 'processResults').callsFake(() => [analysisResult, analysisResult]);
            const processResults2Stub = sinon.stub(tool2, 'processResults').callsFake(() => []);
            const processResults3Stub = sinon.stub(tool3, 'processResults').callsFake(() => [analysisResult]);
            const tools = [tool1, tool2, tool3];

            const actual = codeAnalysisOrchestratorInstance.processResults(tools);
            assert.deepStrictEqual(actual.length, 3);
            sinon.assert.calledOnceWithExactly(processResults1Stub);
            sinon.assert.calledOnceWithExactly(processResults2Stub);
            sinon.assert.calledOnceWithExactly(processResults3Stub);
        });
    });

    describe('function \'checkBuildContext\'', () => {
        let getVariableStub;

        before(() => {
            getVariableStub = sinon.stub(tl, 'getVariable');
            sandbox.stub(tl, 'loc');
            sandbox.stub(console, 'log');
        });

        after(() => {
            sandbox.restore();
        });

        afterEach(() => {
            getVariableStub.reset();
        });

        it('should return true if all variables exists', () => {
            getVariableStub.callsFake((variableName) => {
                switch (variableName) {
                    case 'System.DefaultWorkingDirectory':
                    case 'build.artifactStagingDirectory':
                    case 'build.buildNumber':
                        return 'value';
                    default:
                        return null;
                }
            });

            const actual = codeAnalysisOrchestratorInstance.checkBuildContext();
            assert.strictEqual(actual, true);
        });

        it('should return false if some required variable doesn\'t exist', () => {
            getVariableStub.callsFake((variableName) => {
                switch (variableName) {
                    case 'System.DefaultWorkingDirectory':
                    case 'build.buildNumber':
                        return 'value';
                    default:
                        return null;
                }
            });

            const actual = codeAnalysisOrchestratorInstance.checkBuildContext();
            assert.strictEqual(actual, false);
        });
    });
}

function getAnalysisTool(name: string): IAnalysisTool {
    return {
        toolName: name,
        isEnabled: function (): boolean {
            throw new Error('Function not implemented.');
        },
        configureBuild: function (toolRunner: ToolRunner): ToolRunner {
            throw new Error('Function not implemented.');
        },
        processResults: function (): AnalysisResult[] {
            throw new Error('Function not implemented.');
        }
    };
}