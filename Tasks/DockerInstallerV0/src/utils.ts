"use strict";

import tl = require('azure-pipelines-task-lib/task');
import path = require('path');
import fs = require('fs');
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as os from "os";
import * as util from "util";

const uuidV4 = require('uuid/v4');
const dockerToolName = "docker";
const isWindows = os.type().match(/^Win/);
const dockerToolNameWithExtension = dockerToolName + getExecutableExtension();

export async function downloadDocker(version: string, releaseType: string): Promise<string> {

    //docker does not follow strict semversion and has leading zeros in versions <10
    var cleanVersion = version.replace(/(0+)([1-9]+)/, "$2");
    var cachedToolpath = toolLib.findLocalTool(dockerToolName + "-" + releaseType, cleanVersion);

    if (!cachedToolpath) {
        try {
            var dockerDownloadPath = await toolLib.downloadTool(getDockerDownloadURL(version, releaseType), dockerToolName + "-" + uuidV4() + getArchiveExtension());
        } catch (exception) {
            throw new Error(tl.loc("DockerDownloadFailed", getDockerDownloadURL(version, releaseType), exception));
        }

        var unzipedDockerPath;
        if (isWindows) {
            unzipedDockerPath = await toolLib.extractZip(dockerDownloadPath);
        } else {
            //tgz is a tar file packaged using gzip utility
            unzipedDockerPath = await toolLib.extractTar(dockerDownloadPath);
        }

        //contents of the extracted archive are under "docker" directory. caching only "docker(.exe)" CLI
        unzipedDockerPath = path.join(unzipedDockerPath, "docker", dockerToolNameWithExtension);
        cachedToolpath = await toolLib.cacheFile(unzipedDockerPath, dockerToolNameWithExtension, dockerToolName + "-" + releaseType, cleanVersion);
    }

    var Dockerpath = findDocker(cachedToolpath);
    if (!Dockerpath) {
        throw new Error(tl.loc("DockerNotFoundInFolder", cachedToolpath))
    }

    fs.chmodSync(Dockerpath, "755");
    return Dockerpath;
}

function findDocker(rootFolder: string) {
    var DockerPath = path.join(rootFolder, dockerToolNameWithExtension);
    var allPaths = tl.find(rootFolder);
    var matchingResultsFiles = tl.match(allPaths, DockerPath, rootFolder);
    return matchingResultsFiles[0];
}


function getDockerDownloadURL(version: string, releaseType: string): string {
    var platform;
    let architecture = "x86_64";
    switch (os.type()) {
        case 'Linux':
            platform = "linux";
            switch (os.arch()) {
                case 'arm':
                    architecture = "armhf";
                    break;
                case 'arm64':
                    architecture = "aarch64";
                    break;
            }
            break;

        case 'Darwin':
            platform = "mac"; break;

        default:
        case 'Windows_NT':
            platform = "win"; break;
    }
    return util.format("https://download.docker.com/%s/static/%s/%s/docker-%s%s", platform, releaseType,
        architecture, version, getArchiveExtension());
}

function getExecutableExtension(): string {
    if (isWindows) {
        return ".exe";
    }
    return "";
}

function getArchiveExtension(): string {
    if (isWindows) {
        return ".zip";
    }
    return ".tgz";
}
