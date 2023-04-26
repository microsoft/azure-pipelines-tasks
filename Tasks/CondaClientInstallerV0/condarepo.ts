import * as tl from 'azure-pipelines-task-lib/task';
import * as url from 'url';

import * as rp from 'request-promise';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import { version } from 'os';
import path = require('path');

export class CondaEntry {
    public filename: string;
    public baseUrl: string;
    public downloadUrl: url.URL;
    public hash: string;
    private versionElements: Array<number>;

    public addVersionElement(element: number | number[]): void {
        this.versionElements = this.versionElements.concat(element);
    }

    public compare(other: CondaEntry): number {
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

    protected constructor(baseUrl: string, filename: string, hash: string) {
        this.baseUrl = baseUrl;
        this.downloadUrl = new url.URL(filename, baseUrl);
        this.filename = filename;
        this.hash = hash;
        this.versionElements = [];
    }
}

export class MinicondaEntry extends CondaEntry {
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
        super(baseUrl, filename, hash);
    }

    public clone(): MinicondaEntry {
        const clonedEntry = new MinicondaEntry(this.baseUrl, this.filename, this.hash);
        return clonedEntry;
    }
}

export class AnacondaEntry extends CondaEntry {
    public pythonVersionMajor: string;
    public anacondaVersion: string;
    public os: string;
    public architecture: string;
    public extension: string;

    public constructor(baseUrl: string, filename: string, hash: string) {
        super(baseUrl, filename, hash);
    }
}

export class CondaRepo {
    static async loadCondaDirectory(repoUrl: string): Promise<Array<{filename:string, hash: string}>>
    {
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

        return entries;
    }
}

export class AnacondaRepo extends CondaRepo {
    entries: Array<AnacondaEntry>;

    // Parses old and new style of filenames:
    //  Anaconda3-2022.10-Linux-aarch64.sh
    //  Anaconda2-2019.10-Windows-x86_64.exe
    //  Anaconda2-5.3.0-MacOSX-x86_64.sh
    //  Anaconda-1.4.0-Linux-x86_64.sh
    private static readonly versionParseRegex: RegExp =
        new RegExp(String.raw`Anaconda(2|3)?-(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?-(Linux|Windows|MacOSX)-(\w+)\.(\w+)$`);

    private static loadEntries(url: string, parsedHtml: Array<{filename:string, hash: string}>): Array<AnacondaEntry> {
        const entries = new Array<AnacondaEntry>();

        for (let parsed of parsedHtml) {
            if (!parsed.filename || !parsed.hash)
                continue;

            const parts = AnacondaRepo.versionParseRegex.exec(parsed.filename);
            if (!parts)
                continue;

            const entry = new AnacondaEntry(url, parsed.filename, parsed.hash);
            const versionParts = [parts[2], parts[3], parts[4], parts[5]];

            entry.anacondaVersion = versionParts.filter(v => v !== undefined).join(".");
            entry.addVersionElement(versionParts.map(v => v ? Number(v) : 0));
            entry.pythonVersionMajor = parts[1] ?? "2";
            entry.anacondaVersion = parts[2];
            entry.os = parts[3];
            entry.architecture = parts[4];
            entry.extension = parts[5];

            entries.push(entry);
        }

        return entries;
    }

    public static async loadVersionsFromRepo(repoUrl: string) : Promise<AnacondaRepo> {
        const parsedHtml = await AnacondaRepo.loadCondaDirectory(repoUrl);
        const entries = AnacondaRepo.loadEntries(repoUrl, parsedHtml);
        return new AnacondaRepo(entries);
    }

    public getEntry(pythonMajor: string, anacondaVersion: string, os: string, arch: string, ext: string) : CondaEntry {
        const entry = this.entries.find(entry =>
            entry.pythonVersionMajor === pythonMajor
            && entry.anacondaVersion === anacondaVersion
            && entry.os === os
            && entry.architecture === arch
            && entry.extension === ext);
        return entry;
    }

    public getLatestEntry(pythonMajor: string, os: string, arch: string, ext: string) : CondaEntry {
        let filtered = this.entries.filter(entry =>
            entry.pythonVersionMajor === pythonMajor
            && entry.os === os
            && entry.architecture === arch
            && entry.extension === ext);

        if (filtered.length === 0)
            throw new Error('Error_RequestedVersionDoesNotExist'); // TODO: stuff in the provided params
            // throw new Error(tl.loc('Error_RequestedVersionDoesNotExist')); // TODO: stuff in the provided params
        else if (filtered.length === 1)
            return filtered[0];

        filtered.sort((a, b) => b.compare(a));
        return filtered[0];
    }

    private constructor(entries: Array<AnacondaEntry>) {
        super();
        this.entries = entries;
    }
}

export class MinicondaRepo extends CondaRepo {
    public entries: Array<MinicondaEntry>;
    public latestEntries: Array<MinicondaEntry>;

    // Parses old and new style of filenames:
    //      Miniconda-1.6.0-Linux-x86_64.sh
    //      Miniconda3-py37_4.8.2-Linux-ppc64le.sh
    //      Miniconda3-py310_22.11.1-1-Linux-aarch64.sh
    private static readonly versionParseRegex: RegExp =
        new RegExp(String.raw`Miniconda(2|3)?-(?:py(2|3)(\d+)_)?(\d+)\.(\d+)\.(\d+)(?:-(\d+))?-(Linux|Windows|MacOSX)-(\w+)\.(\w+)$`);

    private static loadEntries(baseUrl: string, parsedHtml: Array<{filename:string, hash: string}>): [Array<MinicondaEntry>, Array<MinicondaEntry>] {
        const entries = new Array<MinicondaEntry>();
        const latestEntries = new Array<MinicondaEntry>();

        const latestParsedHtml = new Array<{filename:string, hash: string}>();
        for (let parsed of parsedHtml) {
            if (!parsed.filename || ! parsed.hash)
                continue;

            if (parsed.filename.includes("latest")) {
                latestParsedHtml.push(parsed); //we'll use the hashes to resolve these later
                continue;
            }

            const parts = MinicondaRepo.versionParseRegex.exec(parsed.filename);
            if (!parts)
                continue;

            const entry = new MinicondaEntry(baseUrl, parsed.filename, parsed.hash);
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

            entries.push(entry);
        }

        for (let parsed of latestParsedHtml) {
            const entry = entries.find(entry => entry.hash === parsed.hash);
            if (!entry)
                throw new Error('Latest entry has no matching entry in Miniconda Repo');

            const newEntry: MinicondaEntry = entry.clone();
            newEntry.filename = parsed.filename;
            newEntry.downloadUrl = new url.URL(parsed.filename, baseUrl);

            latestEntries.push(newEntry);
        }

        return [entries, latestEntries];
    }

    public static async loadVersionsFromRepo(repoUrl: string) : Promise<MinicondaRepo> {
        const parsedHtml = await MinicondaRepo.loadCondaDirectory(repoUrl);
        const [entries, latesteEntries] = MinicondaRepo.loadEntries(repoUrl, parsedHtml);
        return new MinicondaRepo(entries, latesteEntries);
    }

    public getLatestEntry(pythonMajor: string, os: string, arch: string, ext: string) : CondaEntry {
        const entry = this.latestEntries.find(entry =>
                entry.pythonVersionMajor === pythonMajor
                && entry.os === os
                && entry.architecture === arch
                && entry.extension === ext);

        if (!entry)
            throw new Error(`No 'latest' miniconda version found with these parameters: pythonMajor: ${pythonMajor}, os: ${os}, cpuArch: ${arch}, fileExtension: ${ext}`);

        return entry;
    }

    public getEntry(pythonMajor: string, pythonMinor: string, condaVersion: string, os: string, arch: string, ext: string) : CondaEntry {
        const [condaMajor, condaMinor, condaPatch, condaRevision] = condaVersion ? condaVersion.split(".") : [];

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
            // throw new Error('Error_RequestedVersionDoesNotExist'); // TODO: stuff in the provided params
            // throw new Error(tl.loc('Error_RequestedVersionDoesNotExist')); // TODO: stuff in the provided params
        else if (filtered.length === 1)
            return filtered[0];

        filtered.sort((a, b) => b.compare(a));
        return filtered[0];
    }

    private constructor(entries: Array<MinicondaEntry>, latestEntries: Array<MinicondaEntry>) {
        super();
        this.entries = entries;
        this.latestEntries = latestEntries;
    }
}
