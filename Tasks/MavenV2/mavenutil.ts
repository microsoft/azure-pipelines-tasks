import Q = require('q');
import os = require('os');
import path = require('path');
import fs = require('fs');
import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common-v3/locationUtilities";
import { logError } from 'azure-pipelines-tasks-packaging-common-v3/util';

import * as url from "url";
import * as xml2js from 'xml2js';
import * as fse from 'fs-extra';

let stripbom = require('strip-bom');
let base64 = require('base-64');
let utf8 = require('utf8');
let uuidV4 = require("uuid/v4");

const accessTokenEnvSetting: string = 'ENV_MAVEN_ACCESS_TOKEN';

function readXmlFileAsJson(filePath: string): Q.Promise<any> {
    return readFile(filePath, 'utf-8')
        .then(convertXmlStringToJson);
}

function readFile(filePath: string, encoding: string): Q.Promise<string> {
    return Q.nfcall<string>(fs.readFile, filePath, encoding);
}

async function convertXmlStringToJson(xmlContent: string): Promise<any> {
    return Q.nfcall<any>(xml2js.parseString, stripbom(xmlContent));
}

function writeJsonAsXmlFile(filePath: string, jsonContent: any, rootName:string): Q.Promise<void> {
    let builder = new xml2js.Builder({
        pretty: true,
        headless: true,
        rootName: rootName
    });
    let xml = builder.buildObject(jsonContent);
    xml = xml.replace(/&#xD;/g, "");
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
    if (!obj) {
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

function mavenSettingsJsonInsertServer (json: any, serverJson:any) {
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
}

export function mergeCredentialsIntoSettingsXml(settingsXmlFile:string, repositories:any): Q.Promise<any> {
    tl.debug('merging server credentials into settings.xml file=' + settingsXmlFile);
    if (repositories) {
        let insertServer = function(json) {
            for (let repository of repositories) {
                tl.debug('repository: ' + JSON.stringify(repository));
                let serverJson:any = {
                    id: repository.id,
                    configuration: {
                        httpHeaders: {
                            property: {
                                name: 'Authorization',
                                value: 'Basic ${env.' + accessTokenEnvSetting + '}'
                            }
                        }
                    }
                };
                tl.debug('inserting: ' + JSON.stringify(serverJson));
                mavenSettingsJsonInsertServer(json, serverJson);
            }
            tl.debug('complete json: ' + JSON.stringify(json));
            return writeJsonAsSettingsFile(settingsXmlFile, json);
        };
        return readXmlFileAsJson(settingsXmlFile).then(insertServer)
        .fail(function() {
            let json:any = {};
            return insertServer(json);
        });
    } else {
        tl.debug('no repositories...exitting');
        return Q.resolve(true);
    }
}

function getAuthenticationToken() {
    return base64.encode(utf8.encode('VSTS:' + pkgLocationUtils.getSystemAccessToken()));
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

interface RepositoryInfo {
    id:string;
}

async function collectFeedRepositories(pomContents:string): Promise<any> {
    let pomJson = await convertXmlStringToJson(pomContents);
    let repos:RepositoryInfo[] = [];
    if (!pomJson) {
        tl.debug('Incomplete pom: ' + pomJson);
        return Promise.resolve(repos);
    }
    const collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Maven);
    } catch (error) {
        tl.debug("Unable to get packaging URIs");
        logError(error);
        throw error;
    }

    let packageUrl = packagingLocation.DefaultPackagingUri;
    tl.debug('collectionUrl=' + collectionUrl);
    tl.debug('packageUrl=' + packageUrl);
    let collectionName:string = url.parse(collectionUrl).hostname.toLowerCase();
    let collectionPathName = url.parse(collectionUrl).pathname;
    if(collectionPathName && collectionPathName.length > 1) {
        collectionName = collectionName + collectionPathName.toLowerCase();
        tl.debug('collectionName=' + collectionName);
    }
    if (packageUrl) {
        url.parse(packageUrl).hostname.toLowerCase();
    } else {
        packageUrl = collectionName;
    }
    let parseRepos:(project) => void = function(project) {
        if (project && project.repositories) {
            for (let r of project.repositories) {
                r = r instanceof Array ? r[0] : r;
                if (r.repository) {
                    for (let repo of r.repository) {
                        repo = repo instanceof Array ? repo[0] : repo;
                        let url:string = repo.url instanceof Array ? repo.url[0] : repo.url;
                        if (url && (url.toLowerCase().includes(collectionName) ||
                                    url.toLowerCase().includes(packageUrl) ||
                                    packagingLocation.PackagingUris.some(uri => url.toLowerCase().startsWith(uri.toLowerCase())))) {
                        tl.debug('using credentials for url: ' + url);
                        repos.push({
                            id: (repo.id && repo.id instanceof Array)
                                ? repo.id[0]
                                : repo.id
                            });
                        }
                    }
                }
            }
        }
    };

    if (pomJson.projects && pomJson.projects.project) {
        for (let project of pomJson.projects.project) {
            parseRepos(project);
        }
    } else if (pomJson.project) {
        parseRepos(pomJson.project);
    } else {
        tl.warning(tl.loc('EffectivePomInvalid'));
    }

    tl.debug('Feeds found: ' + JSON.stringify(repos));
    return Promise.resolve(repos);
}

export function collectFeedRepositoriesFromEffectivePom(mavenOutput:string): Promise<any> {
    tl.debug('collecting account feeds from effective pom');
    const effectivePomStartTag:string = '<!-- Effective POM';
    const projectsBeginTag:string = '<projects';
    const projectsEndTag:string = '</projects>';
    const projectBeginTag:string = '<project';
    const projectEndTag:string = '</project>';

    let xml:string = String(mavenOutput);
    let effectivePomStart:number = xml.lastIndexOf(effectivePomStartTag);
    if (effectivePomStart === -1) {
        tl.warning(tl.loc('EffectivePomInvalid'));
        return Promise.resolve(true);
    }

    let xmlStart:number = xml.indexOf(projectsBeginTag, effectivePomStart);
    let xmlEnd:number = xml.indexOf(projectsEndTag, effectivePomStart);
    if (xmlStart !== -1 && xmlEnd !== -1 && (xmlStart < xmlEnd)) {
        xml = xml.substring(xmlStart, xmlEnd + projectsEndTag.length);
        return collectFeedRepositories(xml);
    }

    xmlStart = xml.indexOf(projectBeginTag, effectivePomStart);
    xmlEnd = xml.indexOf(projectEndTag, effectivePomStart);
    if (xmlStart !== -1 && xmlEnd !== -1 && (xmlStart < xmlEnd)) {
        xml = xml.substring(xmlStart, xmlEnd + projectEndTag.length);
        return collectFeedRepositories(xml);
    }

    tl.warning(tl.loc('EffectivePomInvalid'));
    return Promise.resolve(true);
}

export function getExecOptions(): tr.IExecOptions {
    var env = process.env;
    env[accessTokenEnvSetting] = getAuthenticationToken();
    return <tr.IExecOptions> {
        env: env,
    };
}

export function publishMavenInfo(mavenInfo: string) {
    const stagingDir: string = path.join(tl.getVariable('Agent.TempDirectory'), '.mavenInfo');
    const randomString: string = uuidV4();
    const infoFilePath: string = path.join(stagingDir, 'MavenInfo-' + randomString + '.md');
    if (!tl.exist(stagingDir)) {
        tl.mkdirP(stagingDir);
    }
    tl.writeFile(infoFilePath, mavenInfo);
    tl.debug('[Maven] Uploading build maven info from ' + infoFilePath);
    tl.command('task.addattachment',
                {
                    'type': 'Distributedtask.Core.Summary',
                    'name': 'Maven'
                },
                infoFilePath);
}
