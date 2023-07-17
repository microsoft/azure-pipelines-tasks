import * as tl from 'azure-pipelines-task-lib/task';
import * as url from 'url';
import * as rp from 'request-promise';
import * as fs from 'fs';
import * as  path from 'path';
const cheerio = require('cheerio'); // can't do import due to typescript version incompatibility

export async function loadMinicondaRepo(repoUrl: string): Promise<MinicondaRepo> {
    const rawHTML = await rp.get(repoUrl);
    const parsed = cheerio.load(rawHTML);

    const entries = [];
    parsed("html > body > table > tbody > tr").each((index, element) => {
        if (index <= 1)
            return true;
        const tds = parsed(element).find("td");
        const filename = parsed(tds[0]).text();
        const hash = parsed(tds[3]).text();
        entries.push({filename, hash})
    });

    return new MinicondaRepo(repoUrl, entries);
}

export class MinicondaEntry {
    public filename: string;
    public baseUrl: string;
    public downloadUrl: url.URL;
    public hash: string;
    private versionElements: Array<number>;

    public pythonVersionMajor: string;
    public pythonVersionMinor: string;
    public condaVersionMajor: string;
    public condaVersionMinor: string;
    public condaVersionPatch: string;
    public condaVersionRevision: string;
    public os: string;
    public architecture: string; // x64, x86, etc.
    public extension: string; // exe, sh

    public constructor(baseUrl: string, filename: string, hash: string) {
        this.baseUrl = baseUrl;
        this.downloadUrl = new url.URL(filename, baseUrl);
        this.filename = filename;
        this.hash = hash;
        this.versionElements = [];
    }

    public clone(): MinicondaEntry {
        const clonedEntry = new MinicondaEntry(this.baseUrl, this.filename, this.hash);
        
        clonedEntry.pythonVersionMajor = this.pythonVersionMajor;
        clonedEntry.pythonVersionMinor = this.pythonVersionMinor;
        clonedEntry.condaVersionMajor = this.condaVersionMajor;
        clonedEntry.condaVersionMinor = this.condaVersionMinor;
        clonedEntry.condaVersionPatch = this.condaVersionPatch;
        clonedEntry.condaVersionRevision = this.condaVersionRevision;
        clonedEntry.os = this.os;
        clonedEntry.architecture = this.architecture;
        clonedEntry.extension = this.extension;

        return clonedEntry;
    }

    public addVersionElement(element: number | number[]): void {
        this.versionElements = this.versionElements.concat(element);
    }

    public compare(other: MinicondaEntry): number {
        for (let i = 0; i < Math.max(this.versionElements.length, other.versionElements.length); ++i) {
            if (this.versionElements[i] === undefined || this.versionElements[i] < other.versionElements[i])
                return -1;
            if (other.versionElements[i] === undefined || this.versionElements[i] > other.versionElements[i])
                return 1;
        }
        return 0;
    }

    public async download() : Promise<string> {
        const optionsStart = {
            uri: this.downloadUrl,
            method: "GET",
            encoding: "binary",
            headers: {
                "Content-type": "application/octet-stream"
            }
        };

        const res = await rp.get(optionsStart);
        const buf = Buffer.from(res, 'binary');

        fs.writeFileSync(this.filename, buf);

        return path.join(tl.cwd(), this.filename);
    }
}

export class MinicondaRepo {
    private baseUrl: string;
    private entries: Array<MinicondaEntry> = [];
    private latestEntries: Array<MinicondaEntry> = [];

    // Parses old and new style of filenames:
    //      Miniconda-1.6.0-Linux-x86_64.sh
    //      Miniconda3-py37_4.8.2-Linux-ppc64le.sh
    //      Miniconda3-py310_22.11.1-1-Linux-aarch64.sh
    private static readonly versionParseRegex: RegExp =
        new RegExp(String.raw`Miniconda(2|3)?-(?:py(2|3)(\d+)_)?(\d+)\.(\d+)\.(\d+)(?:-(\d+))?-(Linux|Windows|MacOSX)-(\w+)\.(\w+)$`);

    constructor(url: string, versionList: Array<{filename:string, hash: string}>) {
        this.baseUrl = url
        this.loadEntries(versionList);
    }

    public getLatestEntry(pythonMajor: string, os: string, arch: string, ext: string): MinicondaEntry {
        const entry = this.latestEntries.find(entry =>
                entry.pythonVersionMajor === pythonMajor
                && entry.os === os
                && entry.architecture === arch
                && entry.extension === ext);

        if (!entry)
            throw new Error(`No 'latest' miniconda version found with these parameters: pythonMajor: ${pythonMajor}, os: ${os}, cpuArch: ${arch}, fileExtension: ${ext}`);

        return entry;
    }

    public getEntry(pythonMajor: string, pythonMinor: string, condaVersion: string, os: string, arch: string, ext: string): MinicondaEntry {
        let [condaMajor, condaMinor, condaPatch, condaRevision] = condaVersion ? condaVersion.split(".") : [];
        if (condaPatch) // check if we also have a revision, which is separated by a '-', instead of a '.'
            [condaPatch, condaRevision] = condaPatch.split("-");

        let filtered = this.entries.filter(entry =>
            entry.pythonVersionMajor === pythonMajor
            && (!pythonMinor || entry.pythonVersionMinor === pythonMinor)
            && (!condaMajor || entry.condaVersionMajor === condaMajor)
            && (!condaMinor || entry.condaVersionMinor === condaMinor)
            && (!condaPatch || entry.condaVersionPatch === condaPatch)
            && (!condaRevision || entry.condaVersionRevision === condaRevision)
            && entry.os === os
            && entry.architecture === arch
            && entry.extension === ext);

        if (filtered.length === 0)
            throw new Error(`No miniconda version found with these parameters: pythonMajor: ${pythonMajor}, pythonMinor: ${pythonMinor}, condaVersion: ${condaVersion}, os: ${os}, cpuArch: ${arch}, fileExtension: ${ext}`);
        else if (filtered.length === 1)
            return filtered[0];

        filtered.sort((a, b) => b.compare(a));
        return filtered[0];
    }

    private loadEntries(versionList: Array<{filename:string, hash: string}>) {
        const latestVersions = new Array<{filename:string, hash: string}>();
        for (let version of versionList) {
            if (!version.filename || ! version.hash)
                continue;

            if (version.filename.includes("latest")) {
                latestVersions.push(version); //we'll use the hashes to resolve these later
                continue;
            }

            const parts = MinicondaRepo.versionParseRegex.exec(version.filename);
            if (!parts)
                continue;

            const entry = new MinicondaEntry(this.baseUrl, version.filename, version.hash);
            entry.pythonVersionMajor = parts[2] ?? parts[1] ?? "2";
            entry.pythonVersionMinor = parts[3] ?? "0";
            entry.condaVersionMajor = parts[4];
            entry.condaVersionMinor = parts[5];
            entry.condaVersionPatch = parts[6];
            entry.condaVersionRevision = parts[7] ?? "0";
            entry.os = parts[8];
            entry.architecture = parts[9];
            entry.extension = parts[10];

            const versionParts = [entry.pythonVersionMinor, entry.condaVersionMajor, entry.condaVersionMinor, entry.condaVersionPatch, entry.condaVersionRevision];
            entry.addVersionElement(versionParts.map(v => v ? Number(v) : 0));

            this.entries.push(entry);
        }

        for (let latestVersion of latestVersions) {
            const entry = this.entries.find(entry => entry.hash === latestVersion.hash);
            if (!entry)
                throw new Error('Latest entry has no matching entry in Miniconda Repo');

            const newEntry: MinicondaEntry = entry.clone();
            newEntry.filename = latestVersion.filename;
            newEntry.downloadUrl = new url.URL(latestVersion.filename, this.baseUrl);

            this.latestEntries.push(newEntry);
        }
    }
}
