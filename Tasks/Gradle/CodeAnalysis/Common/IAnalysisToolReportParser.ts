import {AnalysisResult} from './AnalysisResult'

/**
 * Contract for Java code analysis tools (e.g. PMD, FindBugs etc.) to extract and parse 
 * the results  
 * 
 * @export
 * @interface IAnalysisToolReportParser
 */
export interface IAnalysisToolReportParser {

    parse(): AnalysisResult[];
}

