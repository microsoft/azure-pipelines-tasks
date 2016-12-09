/// <reference path="../../../../definitions/vsts-task-lib.d.ts" />
import tl = require('vsts-task-lib/task');

//jeyou: why is this exported?
export class SonarQubeEndpoint {
    private url: string;
    private username: string;
    private password: string;

    public get Url(): string {
        return this.url;
    }
    public get Username(): string {
        return this.username;
    }
    public get Password(): string {
        return this.password;
    }

    //jeyou: why are these explicitly public? (they get exposed as public properties of the same name)
    constructor(/*public*/ url: string, /*public*/ username: string, /*public*/ password: string) {
        this.url = url;
        this.username = username;
        this.password = password;
    }

    public static getTaskSonarQubeEndpoint(): SonarQubeEndpoint {
        //jeyou: is getEndpointUrl supposed to be a function call?
        if (tl.getEndpointUrl == null) {
            tl.debug('Could not decode the generic endpoint. Please ensure you are running the latest agent (min version 0.3.2)');
            //jeyou: no error message (loc'd)?
            throw new Error();
        }

        let genericEndpointName: string = tl.getInput('sqConnectedServiceName');
        let hostUrl: string = tl.getEndpointUrl(genericEndpointName, false);

        tl.debug(`[SQ] SonarQube endpoint: ${hostUrl}`);

        // Currently the username and the password are required, but in the future they will not be mandatory
        // - so not validating the values here
        let hostUsername: string = SonarQubeEndpoint.getSonarQubeAuthParameter(genericEndpointName, 'username');
        let hostPassword: string = SonarQubeEndpoint.getSonarQubeAuthParameter(genericEndpointName, 'password');

        return new SonarQubeEndpoint(hostUrl, hostUsername, hostPassword);
    }

    // Gets a SonarQube authentication parameter from the specified connection endpoint.
    // The endpoint stores the auth details as JSON. Unfortunately the structure of the JSON has changed through time, namely the keys were sometimes upper-case.
    // To work around this, we can perform case insensitive checks in the property dictionary of the object. Note that the PowerShell implementation does not suffer from this problem.
    // See https://github.com/Microsoft/vso-agent/blob/bbabbcab3f96ef0cfdbae5ef8237f9832bef5e9a/src/agent/plugins/release/artifact/jenkinsArtifact.ts for a similar implementation
    private static getSonarQubeAuthParameter(endpoint: string, paramName: string): string {
        let paramValue: string = null;
        let auth: tl.EndpointAuthorization = tl.getEndpointAuthorization(endpoint, false);

        if (auth.scheme !== 'UsernamePassword') {
            //jeyou: Loc this error?
            throw new Error('The authorization scheme ' + auth.scheme + ' is not supported for a SonarQube endpoint. Please use a username and a password.');
        }

        let parameters: string[] = Object.getOwnPropertyNames(auth['parameters']);

        let keyName: string;
        parameters.some(function (key) {

            if (key.toLowerCase() === paramName.toLowerCase()) {
                keyName = key;

                return true;
            }
        });

        if (keyName) {
            paramValue = auth['parameters'][keyName];
        }

        return paramValue;
    }
}
