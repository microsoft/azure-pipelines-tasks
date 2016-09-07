import {AnalysisResult} from './AnalysisResult'
import {ToolRunner} from 'vsts-task-lib/toolrunner';

/**
 * Contract for Java code analysis tools (e.g. PMD, FindBugs etc.) to extract and parse 
 * the results  
 * 
 * @export
 * @interface IAnalysisToolReportParser
 */
export interface IAnalysisTool {

    /**
     * Configure the build to run the analysis 
     * 
     * @param {ToolRunner} toolRunner
     */
    configureBuild(toolRunner: ToolRunner): ToolRunner;

    /**
     * Identify and parse the analysis results 
     * 
     * @returns {AnalysisResult[]}
     */
    processResults(): AnalysisResult[];
}

