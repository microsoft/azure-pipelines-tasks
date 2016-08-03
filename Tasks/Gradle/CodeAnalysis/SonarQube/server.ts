import Q = require('q');
import url = require('url');
import https = require('https');
import http = require('http');
import {IncomingMessage} from 'http';

import {SonarQubeEndpoint} from './endpoint';

import tl = require('vsts-task-lib/task');

export interface ISonarQubeServer {
    /**
     * Invoke a REST endpoint on the SonarQube server.
     * @param path The host-relative path to the REST endpoint (e.g. /api/ce/task)
     * @returns A promise, resolving with a JSON object representation of the response. Rejects on error or non-200 header.
     */
    invokeApiCall(path:string):Q.Promise<Object>;
}

export class SonarQubeServer implements ISonarQubeServer {

    private endpoint:SonarQubeEndpoint;

    constructor(endpoint:SonarQubeEndpoint) {
        this.endpoint = endpoint;
    }

    public invokeApiCall(path:string):Q.Promise<Object> {
        var defer = Q.defer<Object>();

        var options:any = this.createSonarQubeHttpRequestOptions(path);

        // Dynamic switching - we cannot use https.request() for http:// calls or vice versa
        var protocolToUse;
        switch (options.protocol) {
            case 'http':
                protocolToUse = http;
                break;
            case 'https':
                protocolToUse = https;
                break;
            default:
                protocolToUse = http;
                break;
        }

        var responseBody:string = '';
        var request = protocolToUse.request(options, (response:IncomingMessage) => {

            response.on('data', function (body) {
                responseBody += body;
            });

            response.on('end', function () {
                var serverResponseString:string = response.statusCode + " " + http.STATUS_CODES[response.statusCode];

                // HTTP response codes between 200 and 299 inclusive are successes
                if (!(response.statusCode >= 200 && response.statusCode < 300)) {
                    defer.reject(new Error('Server responded with ' + serverResponseString));
                } else {
                    tl.debug('Got response: ' + serverResponseString + " from " + path);

                    if (!responseBody || responseBody.length < 1) {
                        defer.resolve({});
                    } else {
                        defer.resolve(JSON.parse(responseBody));
                    }
                }
            });
        });

        request.on('error', (error) => {
            tl.debug('Failed to call ' + path);
            defer.reject(error);
        });

        tl.debug('Sending request to: ' + path);
        request.end();
        return defer.promise;
    }

    /**
     * Constructs the options object used by the http/https request() method.
     * Defaults to an HTTP request on port 80 to the relative path '/'.
     * @param path The host-relative path to the REST endpoint (e.g. /api/ce/task)
     * @returns An options object to be passed to the request() method
     */
    private createSonarQubeHttpRequestOptions(path?:string):Object {
        var hostUrl:url.Url = url.parse(this.endpoint.Url);
        var authUser = this.endpoint.Username || '';
        var authPass = this.endpoint.Password || '';

        var options = {
            method: 'GET',
            protocol: hostUrl.protocol || 'http',
            host: hostUrl.hostname,
            port: hostUrl.port || 80,
            path: path || '/',
            auth: authUser + ':' + authPass,
            headers: {}
        };

        return options;
    }
}