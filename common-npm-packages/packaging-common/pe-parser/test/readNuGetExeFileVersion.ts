import * as assert from "assert";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as Q from "q";

import * as peReader from "./..";

import VersionInfoVersion from "../VersionInfoVersion";

async function download(url: string, downloadPath: string): Promise<void> {
    let file = fs.createWriteStream(downloadPath);
    file.on("error", err => { throw err; });

    let finishPromise = new Promise(function (resolve, reject) {
        file.on("finish", resolve);
    });

    await new Promise(function (resolve, reject) {
        https.get(url, function (response) {
            if (response.statusCode !== 200) {
                reject(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`);
                return;
            }

            response.on("end", resolve);
            response.on("error", reject);
            response.pipe(file);
        }).on("error", reject);
    });

    file.end(null, null, file.close);
    await finishPromise;
}

const tempDir = path.resolve(__dirname, "..", "_temp");

class NuGetVersion {
    constructor(
        public url: string,
        public version: VersionInfoVersion,
        public stringVersion: string) {
    }

    public get fileName(): string {
        return `NuGet${this.version}.exe`;
    }
    public get filePath(): string {
        return path.resolve(tempDir, this.fileName);
    }
}

const nuGetVersions: NuGetVersion[] = [
    new NuGetVersion(
        "https://dist.nuget.org/win-x86-commandline/v4.0.0/nuget.exe",
        new VersionInfoVersion(4, 0, 0, 2283),
        "4.0.0.2283"
    ),
    new NuGetVersion(
        "https://dist.nuget.org/win-x86-commandline/v3.5.0-rc1/NuGet.exe",
        new VersionInfoVersion(3, 5, 0, 1737),
        "3.5.0-rtm-1737"
    ),
    new NuGetVersion(
        "https://dist.nuget.org/win-x86-commandline/v3.5.0-beta2/NuGet.exe",
        new VersionInfoVersion(3, 5, 0, 1520),
        "3.5.0-beta2-1520"
    ),
    new NuGetVersion(
        "https://dist.nuget.org/win-x86-commandline/v3.4.4/NuGet.exe",
        new VersionInfoVersion(3, 4, 4, 1321),
        "3.4.4-rtm-1321"
    ),
    new NuGetVersion(
        "https://dist.nuget.org/win-x86-commandline/v3.3.0/nuget.exe",
        new VersionInfoVersion(3, 3, 0, 212),
        "3.3.0"
    ),
    new NuGetVersion(
        "https://dist.nuget.org/win-x86-commandline/v3.2.0/nuget.exe",
        new VersionInfoVersion(3, 2, 0, 10516),
        "3.2.0"
    ),
    new NuGetVersion(
        "https://dist.nuget.org/win-x86-commandline/v2.8.6/nuget.exe",
        new VersionInfoVersion(2, 8, 60717, 93),
        "2.8.6"
    ),
];

async function ensureNuGetDownloads(): Promise<void> {
    if (!fs.existsSync(tempDir)) {
        await Q.nfcall(fs.mkdir, tempDir);
    }

    for (let i of nuGetVersions) {
        if (!fs.existsSync(i.filePath)) {
            // tslint:disable-next-line
            console.log(`Downloading ${i.url} to ${i.filePath}`);
            await download(i.url, i.filePath);
        }
    }
}

describe("Can read nuget.exe", function () {
    before(function (done) {
        this.timeout(100000);
        ensureNuGetDownloads().then(() => done()).catch(done);
    });

    for (let i of nuGetVersions) {
        it(`can read version from nuget.exe ${i.version}`, async function () {
            const versionInfo = await peReader.getFileVersionInfoAsync(i.filePath);
            assert(
                versionInfo.fileVersion.equals(i.version),
                `expected ${i.version}, actual ${versionInfo.fileVersion}`);
            assert.strictEqual(versionInfo.strings.ProductVersion, i.stringVersion);
        });
    }
});
