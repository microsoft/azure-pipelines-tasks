import {AnalysisResult} from './analysisresult';

// Data class for supporting Maven projects with more than one module
export class ModuleAnalysis {
    moduleName: string;
    rootDirectory: string;
    analysisResults:ToolAnalysisResultsDict = {};
}

// A dictionary of toolName:string -> analysisResult:AnalysisResult
interface ToolAnalysisResultsDict {
    [toolName:string]:AnalysisResult
}