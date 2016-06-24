/// <reference path="./vsts-task-lib.d.ts" />

declare module 'sonarqube-common/sonarqube-common' {
    import {ToolRunner} from 'vsts-task-lib/toolrunner';

    export const toolName: string;

    // Data class returned from getSonarQubeEndpointDetails()
    export class SonarQubeEndpoint {
        constructor(Url: string, Username: string, Password: string);
        Url: string;
        Username: string;
        Password: string;
    }

    // Returns true if SonarQube integration is enabled.
    export function isSonarQubeAnalysisEnabled(): boolean;

    // Applies required parameters for connecting a Java-based plugin (Maven, Gradle) to SonarQube.
    // sqDbUrl, sqDbUsername and sqDbPassword are required if the SonarQube version is less than 5.2.
    export function applySonarQubeConnectionParams(toolRunner:ToolRunner): ToolRunner;

    // In PR builds, configures the SQ analysis to issues mode
    export function applySonarQubeIssuesModeInPrBuild(toolrunner: ToolRunner);

    // Applies optional parameters for manually specifying the project name, key and version to SonarQube.
    // This will override any user settings.
    export function applySonarQubeAnalysisParams(toolRunner:ToolRunner):ToolRunner;

    // Fetches configured SonarQube endpoint details.
    export function getSonarQubeEndpoint():SonarQubeEndpoint;

    // Returns, as an object, the contents of the 'report-task.txt' file created by SonarQube plugins
    export function uploadSonarQubeBuildSummary(sqBuildFolder: string): void;
}