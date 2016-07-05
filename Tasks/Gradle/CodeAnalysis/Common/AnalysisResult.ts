/**
 * Data class that describes code analysis results
 * 
 * @export
 * @class AnalysisResult
 */
export class AnalysisResult {
    constructor(public toolName: string, public moduleName: string, public resultFiles: string[], public violationCount: number, public affectedFileCount: number) {

    }
}