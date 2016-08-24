import Q = require('q');
//import url = require('url');
import request = require('request');
import {IncomingMessage} from 'http';
import {SonarQubeEndpoint} from './endpoint';

import tl = require('vsts-task-lib/task');

export interface ISonarQubeServer {
    /**
     * Invoke a REST endpoint on the SonarQube server.
     * @param path The host-relative path to the REST endpoint (e.g. /api/ce/task)
     * @returns A promise, resolving with a JSON object representation of the response. Rejects on error or non-2xx header.
     */
    invokeApiCall(path: string): Q.Promise<Object>;
}

export class SonarQubeServer implements ISonarQubeServer {

    private endpoint: SonarQubeEndpoint;

    constructor(endpoint: SonarQubeEndpoint) {
        this.endpoint = endpoint;
    }

    public invokeApiCall(path: string): Q.Promise<Object> {

        tl.debug(`[SQ] Invoking API at: ${path}`);

        var deferred = Q.defer<Object>();

        var authUser = this.endpoint.Username || '';
        var authPass = this.endpoint.Password || '';

        request.get({
            method: 'GET',
            baseUrl: this.endpoint.Url,
            uri: path,
            json: true,
            'auth': {
                'user': authUser,
                'pass': authPass,
            }            
        }, (error, response, body) => {
            if (error) {
                tl.debug(`Request failed because of error: ${error}`);
                deferred.reject(error);
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                tl.debug(`Request failed because the status code was: ${response.statusCode}`);
                deferred.reject(new Error(`Request failed because the status code was: ${response.statusCode}`));
            }

            if (!body || body.length < 1) {
                deferred.resolve({});
            } else {
                deferred.resolve(body);
            }
        });


        return deferred.promise;
      
    }

}