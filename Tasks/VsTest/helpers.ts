import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');
import path = require('path');
import Q = require('q');
import models = require('./models')

var os = require('os');
var uuid = require('node-uuid');
var fs = require('fs');
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var builder = new xml2js.Builder();

export class Helper{
    public static addToProcessEnvVars(envVars: { [key: string]: string; }, name: string, value: string) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value;
        }
    }

    public static setEnvironmentVariableToString(envVars: { [key: string]: string; }, name: string, value: any) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value.toString();
        }
    }

    public static isNullEmptyOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }

    public static isNullOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }

    public static pathExistsAsFile(path: string) {
        return tl.exist(path) && tl.stats(path).isFile();
    }

    public static getXmlContents(filePath: string): Q.Promise<any> {
        var defer=Q.defer<any>();
        Helper.readFileContents(filePath, "utf-8")
            .then(function (xmlContents) {
                parser.parseString(xmlContents, function (err, result) {
                    if (err) {
                        defer.resolve(null);
                    }
                    else{
                        defer.resolve(result);
                    }
                });
            })
            .fail(function(err) {
                defer.reject(err);
            });
            return defer.promise;
    }

    public static saveToFile(fileContents: string, extension: string): Q.Promise<string> {
        var defer = Q.defer<string>();
        var tempFile = path.join(os.tmpdir(), uuid.v1() + extension);
        fs.writeFile(tempFile, fileContents, function (err) {
            if (err) {
                defer.reject(err);
            }
            tl.debug("Temporary file created at " + tempFile);
            defer.resolve(tempFile);
        });
        return defer.promise;
    }

    public static readFileContents(filePath: string, encoding: string): Q.Promise<string> {
        var defer = Q.defer<string>();
        fs.readFile(filePath, encoding, (err, data) => {
            if (err) {
                defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
            }
            else {
                defer.resolve(data);
            }
        });
        return defer.promise;
    }

    public static writeXmlFile(result: any, settingsFile: string, fileExt: string): Q.Promise<string> {
        var defer = Q.defer<string>();
        var runSettingsForTestImpact = builder.buildObject(result);
        Helper.saveToFile(runSettingsForTestImpact, fileExt)
            .then(function (fileName) {
                defer.resolve(fileName);
                return defer.promise;
            })
            .fail(function (err) {
                defer.reject(err);
            });
        return defer.promise;
    }
}