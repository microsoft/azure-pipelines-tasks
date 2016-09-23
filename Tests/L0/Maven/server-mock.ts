import http = require('http'); // Used to get the HTTP status code meanings
import Q = require('q');

let ISonarQubeServer = require('../../../Tasks/Maven/CodeAnalysis/SonarQube/server').ISonarQubeServer;
let SonarQubeEndpoint = require('../../../Tasks/Maven/CodeAnalysis/SonarQube/endpoint').SonarQubeEndpoint;

export class MockSonarQubeServer /*implements ISonarQubeServer*/ {

    // A map of API endpoints to mock web responses e.g. /api/qualitygates/project_status?analysisId=FOOBAR => {{}, 500, 1}
    public responses:Map<string, MockWebResponse>;

    constructor() {
        this.responses = new Map<string, MockWebResponse>();
    }

    public invokeApiCall(path:string):Q.Promise<Object> {
        var response = this.responses.get(path);
        // If no response was found for the given path, error out
        if (response == null) {
            console.log(`No response was set up for a request to path: ${path}`);
            return Q.reject(new Error(`No response was set up for a request to path: ${path}`));
        }

        // Otherwise, prepare the response
        var serverResponseString:string = response.statusCode + " " + http.STATUS_CODES[response.statusCode];
        console.log('Got response: ' + serverResponseString + " from " + path);
        if (!(response.statusCode >= 200 && response.statusCode < 300)) {
            return Q.reject(new Error('Server responded with ' + serverResponseString));
        }

        // Increment the invoked count
        response.invokedCount++;
        this.responses.set(path, response);

        // Return the response body, as requested
        return Q.when(response.body);
    }

    public setupMockApiCall(path:string, response:any, statusCode?:number):void {
        if (statusCode == undefined) {
            statusCode = 200;
        }
        this.responses.set(path, new MockWebResponse(response, statusCode, 0));
    }
}

class MockWebResponse {
    /**
     * Constructs a mock web response object
     * @param body         deserialized JSON object representing the response body
     * @param statusCode   HTTP response code
     * @param invokedCount number of times this endpoint has been invoked
     */
    constructor(public body:Object, public statusCode:number, public invokedCount:number) {
    }
}