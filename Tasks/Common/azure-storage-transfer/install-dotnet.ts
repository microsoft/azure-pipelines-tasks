const fs = require('fs');
const os = require('os');
const util = require('util');
const path = require('path');
const tl = require('vsts-task-lib/task');
const downloadUtil = require("./downloadutility");
const extractUtil = require("./extractutility");

// this section can be removed in actual task
//fs.mkdirSync(tempWorkingDir);
//tl.setVariable('Agent.TempDirectory', tempWorkingDir);
//tl.setVariable('Agent.Version', '2.115.0');
//tl.setVariable('Agent.ToolsDirectory', path.join(os.homedir(), 'tools'));


//let channel="release/1.1.0"
//let channel="preview"
//let azure_feed="https://dotnetcli.azureedge.net/dotnet"
//let uncached_feed="https://dotnetcli.blob.core.windows.net/dotnet"

// version can be a specific version or latest. if latest, then channel must be set
//let version="1.0.3"
//let channel = null;
//let version="latest"
//let channel = "1.1";

//let shouldUseLatestVersion = false;
//let install_dir="<auto>"

function getDownloadFeedFormat(version: string) {
    if(version.startsWith("1.0")) {
        // channel = preview
        return "https://dotnetcli.azureedge.net/dotnet/preview/Binaries/{version}/dotnet-{os}-{arch}.{version}.{ext}";
    } else if(version.startsWith("1.1")) {
        // channel = release/1.1.0
        return "https://dotnetcli.azureedge.net/dotnet/release/1.1.0/Binaries/{version}/dotnet-{os}-{arch}.{version}.{ext}";
    } else if(version.startsWith("2.")) {
        return "https://dotnetcli.azureedge.net/dotnet/Runtime/{version}/dotnet-runtime-{version}-{os}-{arch}.{ext}";
    }
}

function getVersionFeedFormat(channel: string) {
    if(channel === "1.0") {
        // https://dotnetcli.blob.core.windows.net/dotnet/preview/dnvm/latest.sharedfx.osx.x64.version
        return "https://dotnetcli.blob.core.windows.net/dotnet/preview/dnvm/latest.sharedfx.{os}.{arch}.version";
    } else if(channel === "1.1") {
        // https://dotnetcli.blob.core.windows.net/dotnet/release/1.1.0/dnvm/latest.sharedfx.ubuntu.x64.version
        return "https://dotnetcli.blob.core.windows.net/dotnet/release/1.1.0/dnvm/latest.sharedfx.{os}.{arch}.version";
    } else if(channel === "2.0") {
        return "https://dotnetcli.blob.core.windows.net/dotnet/Runtime/release/2.0.0/latest.version";
    }
}

function getMachineArchitecture() {
    return "x64";
}

function getCurrentOSName() {
    switch (os.type()) {
        case "Windows_NT":
            return "win";
        case "Darwin":
            return "osx"
        case "Linux":
            var releaseInfo = fs.readFileSync('/etc/os-release').toString();
            var allLines = releaseInfo.split(os.EOL);
            var self = this;
            var id;
            var version;
            allLines.forEach(function(line) {
                console.log(line);
                var parts = line.split('=');
                console.log(parts[0]);
                console.log(parts[1]);
                if(parts[0] === 'ID') {
                    id = parts[1];
                } else if(parts[0] === 'VERSION_ID') {
                    version = parts[1].replace(/"/g,"");
                }
            }, self);

            var versionInfo = id + '.' + version;
            console.log("OS version information: " + versionInfo);

            if(versionInfo.startsWith("rhel.7")) {
                return "rhel";
            } else if(versionInfo.startsWith("centos.7")) {
                return "centos";
            } else if(versionInfo.startsWith("ubuntu.16.04")) {
                return "ubuntu.16.04";
            } else if(versionInfo.startsWith("ubuntu.16.10")) {
                return "ubuntu.16.10";
            } else if(versionInfo.startsWith("ubuntu.14.04")) {
                return "ubuntu";
            }

            throw "OS name could not be detected!!";
        default:
            throw "OS name could not be detected!!";
    }
}

function expandUrl(urlFormat, osName, arch, version) {
    let expandedUrl = urlFormat;
    if(osName) {
        expandedUrl = expandedUrl.replace(/{os}/g, osName);
    }

    if(arch) {
        expandedUrl = expandedUrl.replace(/{arch}/g, arch);
    }

    if(version) {
        expandedUrl = expandedUrl.replace(/{version}/g, version);
    }

    if(expandedUrl.indexOf("{ext}") > -1) {
        let ext = osName === "win" ? "zip" : "tar.gz";
        expandedUrl = expandedUrl.replace(/{ext}/g, ext);
    }

    return expandedUrl;
}

async function getLatestVersionInfo(channel, osName, arch) {
    // let versionFileUrlFormat = getVersionFeedFormat(channel);
    // let versionFileUrl = expandUrl(versionFileUrlFormat, osName, arch, null);

    // // use common utlity to download
    // //let tempWorkingDir = path.join(os.tmpdir(), 'd' + Date.now(), Date.now());
    // //var versionFilePath = path.join(tempWorkingDir, "versionFile");
    // let versionFilePath = await toolLib.downloadTool(versionFileUrl);
    // var versionInfos = fs.readFileSync(versionFilePath).toString();
    // // downloaded version file has CRLF line ending
    // return versionInfos.split("\r\n")[1];
}

async function getSpecificVersionFromVersion(channel, osName, arch, version) {
    version = version.toLowerCase();
    switch (version) {
        case "latest":
            return await getLatestVersionInfo(channel, osName, arch);
        default:
            return version;
    }
}

function constructDownloadLink(channel, osName, arch, version) {
    let downloadUrlFormat = getDownloadFeedFormat(version);
    console.log("download url format: " + downloadUrlFormat);
    let downloadLink = expandUrl(downloadUrlFormat, osName, arch, version);
    console.log("Download link: " + downloadLink);
    return downloadLink;
}

function resolveInstallPath(installPath, version, arch) {
    return path.join(installPath, version, arch);
}

function findLocalTool(installPath) {
    //let folderPath = path.join(installRoot, semver.clean(version), arch);
    let markerPath: string = `${installPath}.complete`;
    if(fs.existsSync(installPath) && fs.existsSync(markerPath)) {
        return installPath;
    }

    return null;
}

async function installDotnet(installPath, osName, specificVersion, downloadLink): Promise<void> {
    // if(isDotnetPackageInstalled(installPath, "sdk", specificVersion)) {
    //     console.log("CoreCLR version %s is already installed", specificVersion);
    //     return;
    // }

    // fs.mkdirSync(installPath);

    //let zipPath = path.join(tempWorkingDir, "package.zip");
    //let downloadPath = await toolLib.downloadTool(downloadLink);
    let tempWorkingDir = path.join(os.tmpdir(), 'd' + Date.now());
    tl.mkdirP(tempWorkingDir);
    let downloadPath = path.join(tempWorkingDir, "coreclrarchieve");
    await downloadUtil.download(downloadLink, downloadPath);

    let extPath: string;
    if (osName === 'win') {
        // tl.assertAgent('2.115.0');
        // extPath = tl.getVariable('Agent.TempDirectory');
        // if (!extPath) {
        //     throw new Error('Expected Agent.TempDirectory to be set');
        // }

        // extPath = path.join(extPath, 'd'); // use as short a path as possible due to nested node_modules folders
        await extractUtil.extractZip(downloadPath, installPath);
    }
    else {
        await extractUtil.extractTar(downloadPath, installPath);
    }

    //let toolRoot = path.join(extPath, fileName);
    //return await toolLib.cacheDir(extPath, 'dotnet', specificVersion);


}

function _completeToolPath(installPath: string): void {
     //let folderPath = path.join(installPath, semver.clean(version), arch);
     let markerPath: string = `${installPath}.complete`;
     tl.writeFile(markerPath, '');
     tl.debug('completed installing dotnet core runtime');
}


export async function install(version: string, channel: string, installPath: string): Promise<string> {
    if(version === undefined || version === null) {
        version = "1.1.2";
    }

    if(version === "latest" && !channel) {
        channel = "1.1";
    }

    //let azureFeed = getAzureFeedFormatForVersion(version);
    //let channel = getChannelForVersion(version);
    let arch = getMachineArchitecture();
    let osName = getCurrentOSName();
    let specificVersion = await getSpecificVersionFromVersion(channel, osName, arch, version);
    console.log("version to download: " + specificVersion);
    let resolvedPath = resolveInstallPath(installPath, specificVersion, arch);

    let toolPath = findLocalTool(resolvedPath);
    if(!toolPath) {
        let downloadLink = constructDownloadLink(channel, osName, arch, specificVersion);
        console.log("resolved install path: " + resolvedPath);

        //checkPreReqs()
        await installDotnet(resolvedPath, osName, specificVersion, downloadLink);
        toolPath = resolvedPath;
    }

    console.log("tool path: " + toolPath);
    _completeToolPath(installPath);
    //toolLib.prependPath(toolPath);

    return toolPath;
}

