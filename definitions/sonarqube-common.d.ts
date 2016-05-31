/// <reference path="./vsts-task-lib.d.ts" />

declare module 'sonarqube-common/sonarqube-common' {
    import {ToolRunner} from 'vsts-task-lib/toolrunner';

    // Applies required parameters for connecting a Java-based plugin to SonarQube.
    // sqDbUrl, sqDbUsername and sqDbPassword are required if the SonarQube version is less than 5.2.
    export function applySonarQubeConnectionParams(toolRunner:ToolRunner, sqHostUrl, sqHostUsername, sqHostPassword, sqDbUrl?, sqDbUsername?, sqDbPassword?):ToolRunner;

    // Applies optional parameters for manually specifying the project name, key and version to SonarQube.
    // This will override any user settings.
    export function applySonarQubeAnalysisParams(toolRunner:ToolRunner, projectName?, projectKey?, projectVersion?):ToolRunner;

    // Data class returned from getSonarQubeEndpointDetails()
    export class SonarQubeEndpoint {
        constructor(Url, Username, Password);

        Url: string;
        Username: string;
        Password: string;
    }

    // Fetches configured SonarQube endpoint details.
    export function getSonarQubeEndpointFromInput(inputFieldName):SonarQubeEndpoint;
}