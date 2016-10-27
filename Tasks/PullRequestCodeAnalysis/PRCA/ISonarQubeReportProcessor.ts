import {Message} from './Message';

/**
 * Responsible for processing a SonarQube report to extract code analysis issues from it
 * 
 * @export
 * @class SonarQubeReportProcessor
 */
export interface ISonarQubeReportProcessor {
    /**
     * Extracts the messages to be posted from a SonarQube report file
     * 
     * @param {string} reportPath (description)
     * @returns {Message[]} (description)
     */
    FetchCommentsFromReport(reportPath: string): Message[];
}
