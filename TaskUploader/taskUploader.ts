/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/Q.d.ts" />

import Q = require("q");
import fs = require("fs");
import url = require("url");
import http = require("http");
import https = require("https");

var archiver = require("archiver");
var read = require("read");
var process = require("process");

function _getOptions(method: string, requestUrl: string, headers: any): any {
    var parsedUrl: url.Url = url.parse(requestUrl);
    var usingSsl = parsedUrl.protocol === 'https:';
    var prot: any = usingSsl ? https : http;
    var defaultPort = usingSsl ? 443 : 80;

    var proxyUrl: url.Url;
    if (process.env.HTTP_PROXY) {
        proxyUrl = url.parse(process.env.HTTP_PROXY);
        prot = proxyUrl.protocol === 'https:' ? https: http;
    }

    var options = { headers: {}};

    var useProxy = proxyUrl && proxyUrl.hostname;
    if (useProxy) {
        // TODO: support proxy-authorization
        options = {
            host: proxyUrl.hostname,
            port: proxyUrl.port || 8888,
            path: requestUrl,
            method: method,
            headers: {}
        }
    }
    else {
        options = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || defaultPort,
            path: (parsedUrl.pathname || '') + (parsedUrl.search || ''),
            method: method,
            headers: {}
        }            
    }

    options.headers = headers;

    if (useProxy) {
        options.headers['Host'] = parsedUrl.hostname;
    }

    if (this.handler) {
        this.handler.prepareRequest(options);
    }

    return {
        protocol: prot,
        options: options,
    };
}

function _sendFile(verb: string, requestUrl: string, content: any, headers: any, onResult: (err: any, res: http.ClientResponse, contents: string) => void): void {
    var options = _getOptions(verb, requestUrl, headers);

    var req = options.protocol.request(options.options, function (res) {
        var output = '';
    
        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function () {
            // res has statusCode and headers
            onResult(null, res, output);
        });
    });

    req.on('error', function (err) {
        // err has statusCode property
        // res should have headers
        onResult(err, null, null);
    });

    content.on('close', function () {
        req.end();
    });

    content.pipe(req);
}

interface ICredentials {
	username: string;
    password: string;
    action: string;
}

var accountUrl: string = process.argv[2];
var taskFolder: string = process.argv[3];

if (!fs.existsSync(taskFolder)) {
	throw new Error("Folder '" + taskFolder + "' does not exist.");
}
else if (!fs.existsSync(taskFolder + "/task.json")) {
	throw new Error("File '" + taskFolder + "/task.json' does not exist.");
}

var taskJson = fs.readFileSync(taskFolder + "/task.json", "utf8").trim();
var taskDefinition = JSON.parse(taskJson);
var taskId = taskDefinition.id;
if (!taskId) {
	throw new Error("File '" + taskFolder + "/task.json' does not look like a valid task definition.");
}

var credsPromise: Q.Promise<ICredentials> = Q.nfcall(read, { prompt: 'username: ' }).then((username: string) => {
    return Q.nfcall(read, { prompt: 'password: ', silent: true }).then((password: string) => {
        return Q.nfcall(read, { prompt: 'action: ' }).then((action: string) => {
            if (action[0]) {
                action[0] = action[0].toUpperCase();
                if (action[0] != 'PUT' && action[0] != 'DELETE') {
                    throw new Error("The value " + action[0] + " is not a valid action.");
                }
            }
            else {
                action[0] = 'PUT';
            }

            return {
                username: username[0],
                password: password[0],
                action: action[0]
            }
        });
    });
});

var taskUrl = url.resolve(accountUrl, "_apis/distributedtask/tasks/" + taskId);
credsPromise.then((creds: ICredentials) => {
    var headers = {
        "User-Agent": "vso-task-api",
        // 2.0 is the single-PUT version
        "Accept": "application/json; api-version=2.0-preview",
        "Authorization": 'Basic ' + new Buffer(creds.username + ':' + creds.password).toString("base64"),
        "X-TFS-FedAuthRedirect": "Suppress",
        "Content-Type": "application/octet-stream"
    };

    var archive = archiver('zip');
    archive.directory(taskFolder, false);

    _sendFile(creds.action, taskUrl, archive, headers, (err: any, res: any, contents: any) => {
        console.log(res);
        console.log(contents);
        if (err) {
            console.error(err);
        }
    });
    
    archive.finalize();
}).fail((reason) => {
    console.error(reason);
});