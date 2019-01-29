import request = require('request');
import utils = require('./utils');
import q = require('q');

export async function executeCommand(cluster: string, database: string, command: string, accessToken: string): Promise<void> {

    console.log("Sending Kusto command to cluster " + cluster + " database " + database + ":");
    console.log(command);

    var deferral = q.defer<string>();
    request.post(
        "https://" + cluster + "/v1/rest/mgmt",
        {
            headers: { 'Authorization': 'Bearer ' + accessToken },
            json: { db: database, properties: "", csl: command }
        },
        function (error, response, body) {
            if (error) {
                deferral.reject(error);
            } else if (response.statusCode >= 400) {
                deferral.reject(new Error("HTTP error " + response.statusCode + " " + response.statusMessage + ": " + JSON.stringify(body)));
            } else {
                deferral.resolve(body);
            }
        });
    await deferral.promise;
}

interface KustoEndpoint {
    cluster: string;
    database: string
}

/**
 * Split a semicolon-separated list of Kusto endpoints with format https://cluster.kusto.windows.net:443?DatabaseName=database
 */
export function splitEndpointUrls(value: string): KustoEndpoint[] {
    return value.split(";").map(url => {
        var result = /^https:\/\/([^:]+)(:443)?\?DatabaseName=(.*)$/i.exec(url);

        if (!result || (result.length !== 4)) {
            throw new Error("Invalid format of Kusto URL: " + url);
        }

        return { cluster: result[1], database: result[3] };
    });
}

/**
 * Sanitize Kusto scripts and extract individual Kusto commands (by default, blocks of text separated by empty lines)
 */
export function getCommands(script: string, singleCommand: boolean): string[] {
    var commands = [];

    var command = "";
    var isCommandEmpty = true;
    for (var line of script.split(/\r?\n/)) {
        if (!singleCommand && /^\s*$/.test(line)) {
            // Empty line? Means end of command.
            if (!isCommandEmpty) {
                commands.push(command);
            }
            command = "";
            isCommandEmpty = true;
        } else {
            if (isCommandEmpty) {
                if (line.replace(/\/\/.*$/, "").trim().length === 0) {
                    // Skip empty lines and comments before the command starts. Kusto rejects command scripts that do not begin with a dot.
                    continue;
                }
                // A command is considered non-empty if it contains more than blank spaces and comments
                isCommandEmpty = false;
            }
            command += line + "\r\n";
        }
    }
    if (!isCommandEmpty) {
        commands.push(command);
    }

    return commands;
}

/**
 * Set skipvalidation='true' if the command creates/updates a function and does not specify skipvalidation.
 * Skipping validation is needed when functions are created out of order (ex: functions defined in multiple files).
 * Supports commands spanning multiple lines (using the trick [\s\S] = .)
 */
export function insertFunctionValidationSkipping(command: string): string {

    // Function with 'with' statement
    var result = /^([\s\S]*?(\.create-or-alter|\.create|\.alter)\s+function\s+(ifnotexists\s+|)with\s+)\(\s*([\s\S]*?)\s*\)(\s*[\s\S]+?\s*(\([\s\S]*?\)\s*|)\{[\s\S]+\})/.exec(command);
    if ((result !== null) && (result.length === 7)) {
        if (result[4].length === 0) {
            return result[1] + "(skipvalidation='true')" + result[5];
        } else if (!/skipvalidation\s*=\s*'/.test(result[4])) {
            return result[1] + "(skipvalidation='true', " + result[4] + ")" + result[5];
        } else {
            return command;
        }
    }

    // Function without 'with' statement
    result = /^([\s\S]*?(\.create-or-alter|\.create|\.alter)\s+function\s+(ifnotexists\s+|))(\s*[\s\S]+?\s*(\([\s\S]*?\)\s*|)\{[\s\S]+\})/.exec(command);
    if ((result !== null) && (result.length === 6)) {
        return result[1] + "with (skipvalidation='true') " + result[4];
    }

    // Not a function (nothing to do)
    return command;
}
