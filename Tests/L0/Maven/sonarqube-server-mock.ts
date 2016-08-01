import http = require('http'); // Used to get the HTTP status code meanings

import {ISonarQubeServer} from '../../../Tasks/Maven/sonarqube-common/sonarqube-server';
import {SonarQubeEndpoint} from '../../../Tasks/Maven/sonarqube-common/sonarqube-common';

export class MockSonarQubeServer implements ISonarQubeServer {

    public endpoint;

    public responses:Map<string, {body:Object, statusCode:number}>;

    constructor(mockEndpoint:SonarQubeEndpoint) {
        this.endpoint = mockEndpoint;
        this.responses = new Map<string, any>();
    }

    public getEndpoint():SonarQubeEndpoint {
        return this.endpoint;
    }

    public callSonarQubeRestEndpoint(path:string):Q.Promise<Object> {
        var response = this.responses.get(path);

        var serverResponseString:string = response.statusCode + " " + http.STATUS_CODES[response.statusCode];
        console.log('Got response: ' + serverResponseString + " from " + path);
        if (!(response.statusCode >= 200 && response.statusCode < 300)) {
            return Q.reject(new Error('Server responded with ' + serverResponseString));
        }

        return Q.when(response.body);
    }

    public setupMockRestEndpointCall(path:string, response:any, statusCode:number = 200):void {
        this.responses.set(path, {body: response, statusCode: statusCode});
    }

}