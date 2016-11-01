/// <reference path="../../typings/index.d.ts" />

import { Message } from '../../PRCA/Message';
import { ISonarQubeReportProcessor } from '../../PRCA/ISonarQubeReportProcessor';

/**
 * Mock SonarQubeReportProcessor for use in testing
 */
export class MockSonarQubeReportProcessor implements ISonarQubeReportProcessor {

    public messages:Message[] = null;

    /* Interface methods */
    
    public FetchCommentsFromReport(reportPath:string): Message[] {
        return this.messages;
    }

    /* Test methods */

    public SetCommentsToReturn(messages: Message[]):void  {
        this.messages = messages;
    }

}