/// <reference path="./vsts-task-lib.d.ts" />

declare module 'sonarqube-common/sonarqube-common' {
    import {ToolRunner} from 'vsts-task-lib/toolrunner';

    // Apply appropriate -Dkey=value parameters for the given argument values.
    export function applySonarQubeParams(toolRunner:ToolRunner, sqHostUrl, sqHostUsername, sqHostPassword, sqDbUrl?, sqDbUsername?, sqDbPassword?):ToolRunner;

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