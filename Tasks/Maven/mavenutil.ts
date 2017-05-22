
import Q = require('q');
import os = require('os');
import path = require('path');
import fs = require('fs');
import tl = require('vsts-task-lib/task');

import * as str from 'string';
import * as xml2js from 'xml2js';
import * as fse from 'fs-extra';
import * as cheerio from 'cheerio';

let stripbom = require('strip-bom');
let base64 = require('base-64');
let utf8 = require('utf8');

export const accessTokenEnvSetting: string = 'ENV_MAVEN_ACCESS_TOKEN';

const jcenterAuthInfo: any = {
    id: 'jcenter',
    url: 'https://jcenter.bintray.com/'
};

const mavenAuthInfo: any = {
    id: 'maven',
    url: 'http://repo1.maven.org/maven2'
};

function readXmlFileAsJson(filePath: string): Q.Promise<any> {
    return readFile(filePath, 'utf-8')
        .then(convertXmlStringToJson);
}

function readFile(filePath: string, encoding: string): Q.Promise<string> {
    return Q.nfcall<string>(fs.readFile, filePath, encoding);
}

function convertXmlStringToJson(xmlContent: string): Q.Promise<any> {
    return Q.nfcall<any>(xml2js.parseString, stripbom(xmlContent));
}

function writeJsonAsXmlFile(filePath: string, jsonContent: any, rootName:string): Q.Promise<void> {
    let builder = new xml2js.Builder({
        pretty: true,
        headless: true,
        rootName: rootName
    });
    let xml = builder.buildObject(jsonContent);
    xml = str(xml).replaceAll('&#xD;', '').s;
    return writeFile(filePath, xml);
}

function writeJsonAsSettingsFile(filePath: string, jsonContent: any): Q.Promise<void> {
    return writeJsonAsXmlFile(filePath, jsonContent.settings, 'settings');
}

export function writeJsonAsPomFile(filePath: string, jsonContent: any): Q.Promise<void> {
    return writeJsonAsXmlFile(filePath, jsonContent.project, 'project');
}

function writeFile(filePath: string, fileContent: string): Q.Promise<void> {
    fse.mkdirpSync(path.dirname(filePath));
    return Q.nfcall<void>(fs.writeFile, filePath, fileContent, { encoding: 'utf-8' });
}

function addPropToJson(obj: any, propName:string, value: any): void {
    if (typeof obj === 'undefined') {
        obj = {};
    }

    if (obj instanceof Array) {
        let propNode = obj.find(o => o[propName]);
        if (propNode) {
            obj = propNode;
        }
    }

    let containsId: (o) => boolean = function(o) {
        if (value && value.id) {
            if (o.id instanceof Array) {
                return o.id.find((v) => {
                    return v === value.id;
                });
            } else {
                return value.id === o.id;
            }
        }
        return false;
    };

    if (propName in obj) {
        if (obj[propName] instanceof Array) {
            let existing = obj[propName].find(containsId);
            if (existing) {
                tl.warning(tl.loc('EntryAlreadyExists'));
                tl.debug('Entry: ' + value.id);
            } else {
                obj[propName].push(value);
            }
        } else if (typeof obj[propName] !== 'object') {
            obj[propName] = [obj[propName], value];
        } else {
            let prop = {};
            prop[propName] = value;
            obj[propName] = [obj[propName], value];
        }
    } else if (obj instanceof Array) {
        let existing = obj.find(containsId);
        if (existing) {
            tl.warning(tl.loc('EntryAlreadyExists'));
            tl.debug('Entry: ' + value.id);
        } else {
            let prop = {};
            prop[propName] = value;
            obj.push(prop);
        }
    } else {
        obj[propName] = value;
    }
}

function mavenSettingsJsonInsertServer (json: any, settingsXmlFile:string, serverJson:any) {
    if (!json) {
        json = {};
    }
    if (!json.settings || typeof json.settings === "string") {
        json.settings = {};
    }
    if (!json.settings.$) {
        json.settings.$ = {};
        json.settings.$['xmlns'] = 'http://maven.apache.org/SETTINGS/1.0.0';
        json.settings.$['xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        json.settings.$['xsi:schemaLocation'] = 'http://maven.apache.org/SETTINGS/1.0.0' + os.EOL + 'https://maven.apache.org/xsd/settings-1.0.0.xsd';
    }
    if (!json.settings.servers) {
        json.settings.servers = {};
    }
    addPropToJson(json.settings.servers, 'server', serverJson);
    return writeJsonAsSettingsFile(settingsXmlFile, json);
}

export function mergeServerCredentialsIntoSettingsXml(settingsXmlFile:string, server:string): Q.Promise<any> {
    tl.debug('merge server credentials into settings.xml file=' + settingsXmlFile);
    let serverJson:any = {
        id: server,
        configuration: {
            httpHeaders: {
                property: {
                    name: 'Authorization',
                    value: 'Basic ${env.' + accessTokenEnvSetting + '}'
                }
            }
        }
    };
    return readXmlFileAsJson(settingsXmlFile)
    .then(function (json) {
        return mavenSettingsJsonInsertServer(json, settingsXmlFile, serverJson);
    })
    .fail(function () {
        // Generate the settings.xml from scratch
        return mavenSettingsJsonInsertServer(null, settingsXmlFile, serverJson);
    });
}

// TODO: refactor this method out from NPM, NuGet and Maven into a common module
function getSystemAccessToken(): string {
    tl.debug('Getting credentials for local feeds');
    let auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
        tl.debug('Got auth token');
        return auth.parameters['AccessToken'];
    }
    else {
        tl.warning(tl.loc('FeedTokenUnavailable'));
    }
}

export function getAuthenticationToken() {
    return base64.encode(utf8.encode('VSTS:' + getSystemAccessToken()));
}

function insertRepoJsonIntoPomJson(pomJson:any, repoJson:any) {
    if (!pomJson) {
        pomJson = {};
    }
    if (!pomJson.project || typeof pomJson.project === "string") {
        pomJson.project = {};
        pomJson.project.$['xmlns'] = 'http://maven.apache.org/POM/4.0.0';
        pomJson.project.$['xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        pomJson.project.$['xsi:schemaLocation'] = 'http://maven.apache.org/POM/1.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd';
    }
    if (!pomJson.project.repositories) {
        pomJson.project.repositories = {};
    }
    addPropToJson(pomJson.project.repositories, 'repository', repoJson);
}

export function insertRepoIntoPomJson(pomJson:any, repoId:string, repoUrl:string) {
    insertRepoJsonIntoPomJson(pomJson, {
        id: repoId,
        url: repoUrl,
        releases: {
            enabled: true
        },
        snapshots: {
            enabled: true
        }
    });
}

export function readPomAsJson(pomXmlFile:string): Q.Promise<any> {
    tl.debug('reading POM.xml file=' + pomXmlFile);
    return readXmlFileAsJson(pomXmlFile);
}

export function insertPublicReposIntoPom(pomJson:any, includeJCenter:boolean, includeMavenCentral:boolean) {
    if (includeJCenter) {
        tl.debug('inserting JCenter repo');
        insertRepoJsonIntoPomJson(pomJson, jcenterAuthInfo);
    }
    if (includeMavenCentral) {
        tl.debug('inserting Maven Central repo');
        insertRepoJsonIntoPomJson(pomJson, mavenAuthInfo);
    }
}