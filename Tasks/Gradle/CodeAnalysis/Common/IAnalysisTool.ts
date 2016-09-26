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
     * A string representing the name of the tool.
     *
     * @returns {string}
     */
    toolName: string;

    /**
     * Returns true if the user enabled this tool in the UI.
     *
     * @returns {boolean}
     */
    isEnabled(): boolean;

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

