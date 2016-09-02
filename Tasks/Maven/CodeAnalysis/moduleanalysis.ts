import {AnalysisResult} from './analysisresult';

// Data class for supporting Maven projects with more than one module
export class ModuleAnalysis {
    moduleName: string;
    rootDirectory: string;
    // A map of toolName:string -> analysisResult:AnalysisResult
    analysisResultsByToolName: Map<string, AnalysisResult> = new Map<string, AnalysisResult>();
}