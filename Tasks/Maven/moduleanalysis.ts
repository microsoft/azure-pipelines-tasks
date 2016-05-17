import ar = require('./analysisresult');
// Data class for supporting Maven projects with more than one module
export class ModuleAnalysis {
    moduleName: string;
    rootDirectory: string;
    analysisResults:any = {}; // A dictionary of toolName:string -> analysisResult:AnalysisResult
}