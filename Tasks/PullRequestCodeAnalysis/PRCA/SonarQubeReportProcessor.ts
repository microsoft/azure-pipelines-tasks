import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import { PRInjectorError } from './PRInjectorError';
import { Message } from './Message';
import { ILogger } from './ILogger';
import { ISonarQubeReportProcessor } from './ISonarQubeReportProcessor';


export class SonarQubeReportProcessor implements ISonarQubeReportProcessor {

    private logger: ILogger;

    constructor(logger: ILogger) {
        if (!logger) {
            throw new ReferenceError('logger');
        }

        this.logger = logger;
    }

    /* Interface methods */

    public FetchCommentsFromReport(reportPath: string): Message[] {

        if (!reportPath) {
            throw new ReferenceError('Report path is null or empty');
        }

        try {
            fs.accessSync(reportPath, fs.F_OK);
        } catch (e) {
            throw new PRInjectorError('Could not find ' + reportPath + ' - did the SonarQube analysis complete?');
        }

        let sqReportContent: string = fs.readFileSync(reportPath, 'utf8');
        var sonarQubeReport: any;

        try {
            sonarQubeReport = JSON.parse(sqReportContent);
        } catch (e) {
            throw new PRInjectorError('Could not parse the SonarQube report file. The error is: ' + e.message);
        }

        let componentMap = this.BuildComponentMap(sonarQubeReport);
        return this.BuildMessages(sonarQubeReport, componentMap);
    }

    /* Helper methods */

    private BuildComponentMap(sonarQubeReport: any): Map<string, string> {
        let map: Map<string, string> = new Map();

        if (!sonarQubeReport.components) {
            this.logger.LogInfo('The SonarQube report is empty as it lists no components');
            return map;
        }

        for (var component of sonarQubeReport.components) {
            if (!component.key) {
                throw new PRInjectorError('Invalid SonarQube report - some components do not have keys');
            }

            if (component.path != null) {
                var fullPath = component.path;

                if (component.moduleKey != null) { // if the component belongs to a module, we need to prepend the module path
                    // #TODO: Support nested modules once the SonarQube report correctly lists moduleKey in nested modules
                    var module:any = this.GetObjectWithKey(sonarQubeReport.components, component.moduleKey);
                    if (module.path != null) { // some modules do not list a path
                        fullPath = path.join('/', module.path, component.path); // paths must start with a path seperator
                    }
                }

                map.set(component.key, path.normalize(fullPath));
            }
        }

        this.logger.LogDebug(
            util.format(
                'The SonarQube report contains %d components with paths',
                map.size));

        return map;
    }

    private BuildMessages(sonarQubeReport: any, componentMap: Map<string, string>): Message[] {

        let messages: Message[] = [];

        // no components, i.e. empty report
        if (componentMap.size === 0) {
            return messages;
        }

        if (!sonarQubeReport.issues) {
            this.logger.LogInfo('The SonarQube report is empty as there are no issues');
            return messages;
        }

        let issueCount: number = sonarQubeReport.issues.length;
        let newIssues = sonarQubeReport.issues.filter((issue: any) => {
            return issue.isNew === true;
        });

        this.logger.LogInfo(
            util.format('The SonarQube report contains %d issues, out of which %d are new.', issueCount, newIssues.length)
        );

        for (var issue of newIssues) {
            let issueComponent = issue.component;

            if (!issueComponent) {
                throw new PRInjectorError(
                    util.format('Invalid SonarQube report - an issue does not have the component attribute. Content "%s"', issue.content));
            }

            let path: string = componentMap.get(issueComponent);

            if (!path) {
                throw new PRInjectorError(
                    util.format('Invalid SonarQube report - an issue belongs to an invalid component. Content "%s"', issue.content));
            }

            let message: Message = this.BuildMessage(path, issue);

            if (message) {
                messages.push(message);
            }

        }

        return messages;
    }

    // todo: filter out assembly level issues ?
    private BuildMessage(path: string, issue: any): Message {

        // todo: more checks for rule and message 
        let content: string = util.format('%s (%s)', issue.message, issue.rule);
        let priority: number = this.GetPriority(issue);

        if (!issue.line) {
            this.logger.LogWarning(
                util.format(
                    'A SonarQube issue does not have an associated line and will be ignored. File "%s". Content "%s". ',
                    content,
                    path));

            return null;
        }

        let line: number = issue.line;

        if (line < 1) {
            this.logger.LogWarning(
                util.format(
                    'A SonarQube issue was reported on line %d and will be ignored. File "%s". Content "%s".',
                    line,
                    path,
                    content));

            return null;
        }

        let message: Message = new Message(content, path, line, priority);
        return message;
    }

    private GetPriority(issue: any) {

        let severity: string = issue.severity;
        if (!severity) {
            this.logger.LogDebug(util.format('Issue %d does not have a priority associated', issue.content));
            severity = 'none';
        }

        switch (severity.toLowerCase()) {
            case 'blocker':
                return 1;
            case 'critical':
                return 2;
            case 'major':
                return 3;
            case 'minor':
                return 4;
            case 'info':
                return 5;
            default:
                return 6;
        }
    }

    /**
     * Finds and returns the first object with the given key from a given section of the SonarQube report.
     * @param sonarQubeReportSection
     * @param searchKey
     * @returns {any} Null if object not found, otherwise the first object with a "key" field matching searchKey.
     */
    private GetObjectWithKey(sonarQubeReportSection: any, searchKey: string): any {

        if (!sonarQubeReportSection) {
            return null;
        }

        for (var component of sonarQubeReportSection) {
            if (!component.key) {
                throw new PRInjectorError('Invalid SonarQube report - some components do not have keys');
            }

            if (component.key == searchKey) {
                return component;
            }
        }
    }
}


