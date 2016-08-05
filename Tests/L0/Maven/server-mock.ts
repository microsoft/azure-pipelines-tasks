import http = require('http'); // Used to get the HTTP status code meanings
import Q = require('q');

import {ISonarQubeServer} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/server';
import {SonarQubeEndpoint} from '../../../Tasks/Maven/CodeAnalysis/SonarQube/endpoint';

export class MockSonarQubeServer implements ISonarQubeServer {

    public responses:Map<string, {body:Object, statusCode:number}>;

    constructor() {
        this.responses = new Map<string, any>();
    }

    public invokeApiCall(path:string):Q.Promise<Object> {
        var response = this.responses.get(path);
        if (response == null) {
            console.log(`No response was set up for a request to path: ${path}`);
            return Q.reject(new Error(`No response was set up for a request to path: ${path}`));
        }

        var serverResponseString:string = response.statusCode + " " + http.STATUS_CODES[response.statusCode];
        console.log('Got response: ' + serverResponseString + " from " + path);
        if (!(response.statusCode >= 200 && response.statusCode < 300)) {
            return Q.reject(new Error('Server responded with ' + serverResponseString));
        }

        return Q.when(response.body);
    }

    public setupMockApiCall(path:string, response:any, statusCode?:number):void {
        if (statusCode == undefined) {
            statusCode = 200;
        }
        this.responses.set(path, {body: response, statusCode: statusCode});
    }

}