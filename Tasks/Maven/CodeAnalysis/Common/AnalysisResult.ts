import {IAnalysisTool} from './IAnalysisTool';

/**
 * Data class that describes code analysis results
 * 
 * @export
 * @class AnalysisResult
 */
export class AnalysisResult {
    constructor(public originatingTool: IAnalysisTool, public moduleName: string, public resultFiles: string[], public violationCount: number, public affectedFileCount: number) {

    }
}