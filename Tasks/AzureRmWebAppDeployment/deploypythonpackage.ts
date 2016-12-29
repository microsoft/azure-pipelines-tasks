import * as fs from 'fs';
import tl = require('vsts-task-lib');
import path = require('path');
var zipUtility = require('webdeployment-common/ziputility.js');

export async function getPythonPackageRootFolder(webDeployPackage: string, isFolder: boolean) {
    if(isFolder) {
        var folderPathArray = [webDeployPackage];
        for(var folderPath of folderPathArray) {
            var listDir = fs.readdirSync(folderPath);
            for(var dirPath of listDir) {
                if(fs.statSync(path.join(folderPath, dirPath)).isFile()) {
                    if(dirPath === 'requirements.txt' || dirPath === 'runtime.txt') {
                        for(var pathDir of listDir) {
                            if(pathDir.endsWith('.py')) {
                                return folderPath;
                            }
                        }
                        return null;
                    }
                }
                else {
                    folderPathArray.push(path.join(folderPath, dirPath));
                }
            }
        }
    }
    else {
        var archiveFiles = await zipUtility.getArchivedEntries(webDeployPackage);
        console.log(archiveFiles.entries);
        var rootFolder = null;
        for(var archiveFile of archiveFiles.entries) {
            if(archiveFile.endsWith('requirements.txt') || archiveFile.endsWith('runtime.txt')) {
                rootFolder = path.dirname(archiveFile);
                break;
            }
        }
        if(rootFolder) {
            for(var archiveFile of archiveFiles.entries) {
                if(path.dirname(archiveFile) === rootFolder && archiveFile.endsWith('.py')) {
                    return rootFolder;
                }
            }
        }
    }
    return null;
}

async function validatePythonPackage(webPackagePath: string, rootPath: string, isFolder: boolean) {
    if(isFolder) {
        var listDir = fs.readdirSync(rootPath);
        var checkFile = fs.statSync(path.join(rootPath,'web.config')).isFile() && fs.statSync(path.join(rootPath,'ptvs_virtualenv_proxy.py')).isFile();
        return checkFile && listDir.indexOf('web.config') != -1 && listDir.indexOf('ptvs_virtualenv_proxy.py') != -1;            
    }
    else {
        var archiveFiles = await zipUtility.getArchivedEntries(webPackagePath);
        var requiredFileCount = 0;
        for(var archiveFile of archiveFiles.entries) {
            if(path.dirname(archiveFile) === rootPath) {
                if(path.basename(archiveFile) === 'web.config') {
                    requiredFileCount += 1;
                }
                if(path.basename(archiveFile) === 'ptvs_virtualenv_proxy.py') {
                    requiredFileCount += 1;
                }
            }
            if(requiredFileCount === 2) {
                return true;
            }
        }
    }
    return false;
}

export async function checkIfPythonPackage(webAppPackage: string, isFolder: boolean) {
    var rootPath = await getPythonPackageRootFolder(webAppPackage, isFolder);
    if(rootPath) {
        var isValidPythonPackage = await validatePythonPackage(webAppPackage, rootPath, isFolder);
        if(!isValidPythonPackage) {
            throw Error(tl.loc('InvalidPythonPackage'));
        }
        return true;
    }
    return false;
}