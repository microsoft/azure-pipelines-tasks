// Data class for return from code analysis tools.
export class AnalysisResult {
    toolName: string;
    filesWithViolations:number = 0;
    totalViolations:number = 0;
    filesToUpload:string[] = [];
}