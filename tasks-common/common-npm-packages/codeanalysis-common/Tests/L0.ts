import { BaseToolTests } from './BaseToolTests';
import { BuildOutputTests } from './BuildOutputTests';
import { CheckstyleToolTests } from './CheckstyleToolTests';
import { CodeAnalysisOrchestratorTests } from './CodeAnalysisOrchestratorTests';

describe('codeanalysis-common suite', () => {
    describe('BaseTool', BaseToolTests);
    describe('BuildOutput', BuildOutputTests);
    describe('CheckstyleTool', CheckstyleToolTests);
    describe('CodeAnalysisOrchestrator', CodeAnalysisOrchestratorTests);
});