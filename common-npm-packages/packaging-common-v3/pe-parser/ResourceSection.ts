import IReadableFile from "./IReadableFile";
import {SectionTableEntry} from "./SectionTable";

const resourceDirectoryTableHeaderSize = 16;
const resourceDirectoryEntrySize = 8;
const resourceDataEntryLength = 16;

interface RawResourceDirectoryTableHeader {
    characteristics: number;
    timeDateStamp: number;
    majorVersion: number;
    minorVersion: number;
    numberOfNameEntries: number;
    numberOfIdEntries: number;
}

enum ResourceDirectoryEntryIdType { NAME, ID };
interface RawResourceDirectoryEntry {
    nameOffset: number;
    integerId: number;
    dataEntryOffset: number;
    subdirectoryOffset: number;

    /**
     * data entries and subdirectories are distinguished by looking at the high bit. If it's 0, it's a data entry.
     * If it's 1, it's a subdirectory. This is the completely raw value pulled out of the file.
     */
    rawOffsetValue: number;
}

interface RawResourceDirectoryTable {
    header: RawResourceDirectoryTableHeader;
    entries: RawResourceDirectoryEntry[];
}

export interface ResourceData {
    dataRva: number;
    size: number;
    codepage: number;
}

export interface ResourceDirectoryEntry {
    id: number | string;
    data: ResourceData | ResourceDirectory;
}

export class ResourceDirectory {
    public entries: ResourceDirectoryEntry[] = [];

    public getDataEntry(id: string | number): ResourceData {
        const entry = this.entries.find(x => x.id === id && !(x.data instanceof ResourceDirectory));
        if (!entry) {
            return undefined;
        }

        return <ResourceData>entry.data;
    }

    public getSubdirectory(id: string | number): ResourceDirectory {
        const entry = this.entries.find(x => x.id === id && x.data instanceof ResourceDirectory);
        if (!entry) {
            return undefined;
        }

        return <ResourceDirectory>entry.data;
    }
}

async function readRawResourceDirectoryTableHeader(
    file: IReadableFile,
    buffer: Buffer,
    filePosition: number): Promise<RawResourceDirectoryTableHeader> {
    await file.readAsync(buffer, 0, resourceDirectoryTableHeaderSize, filePosition);
    return {
        characteristics: buffer.readUInt32LE(0),
        timeDateStamp: buffer.readUInt32LE(4),
        majorVersion: buffer.readUInt16LE(8),
        minorVersion: buffer.readUInt16LE(10),
        numberOfNameEntries: buffer.readUInt16LE(12),
        numberOfIdEntries: buffer.readUInt16LE(14),
    };
}

async function readRawResourceDirectoryEntry(
    file: IReadableFile,
    buffer: Buffer,
    filePosition: number,
    idType: ResourceDirectoryEntryIdType): Promise<RawResourceDirectoryEntry> {
    await file.readAsync(buffer, 0, resourceDirectoryEntrySize, filePosition);
    let idField = buffer.readUInt32LE(0);
    let offsetField = buffer.readUInt32LE(4);

    // JS acts as if all integers are signed, except for the >>> operator.
    let offsetIsSubdirectory = (offsetField >>> 31) === 1; // tslint:disable-line:no-bitwise
    let offsetValue = offsetField & 0x7FFFFFFF; // tslint:disable-line:no-bitwise

    return {
        nameOffset: idType === ResourceDirectoryEntryIdType.NAME ? idField : undefined,
        integerId: idType === ResourceDirectoryEntryIdType.ID ? idField : undefined,
        dataEntryOffset: !offsetIsSubdirectory ? offsetValue : undefined,
        subdirectoryOffset: offsetIsSubdirectory ? offsetValue : undefined,
        rawOffsetValue: offsetField,
    };
}

async function readRawResourceDirectoryTable(
    file: IReadableFile,
    buffer: Buffer,
    filePosition: number): Promise<RawResourceDirectoryTable> {
    let header = await readRawResourceDirectoryTableHeader(file, buffer, filePosition);

    let entryOffset = filePosition + resourceDirectoryTableHeaderSize;
    let entries: RawResourceDirectoryEntry[] = [];
    for (let i = 0; i < header.numberOfNameEntries; ++i) {
        entries.push(await readRawResourceDirectoryEntry(file, buffer, entryOffset, ResourceDirectoryEntryIdType.NAME));
        entryOffset += resourceDirectoryEntrySize;
    }

    for (let i = 0; i < header.numberOfIdEntries; ++i) {
        entries.push(await readRawResourceDirectoryEntry(file, buffer, entryOffset, ResourceDirectoryEntryIdType.ID));
        entryOffset += resourceDirectoryEntrySize;
    }

    return { header, entries };
}

async function readResourceDirectoryString(file: IReadableFile, buffer: Buffer, filePosition: number): Promise<string> {
    await file.readAsync(buffer, 0, 2, filePosition);
    let length = buffer.readUInt16LE(0);
    await file.readAsync(buffer, 0, length, filePosition + 2);
    return buffer.toString("utf16le", 0, length);
}

async function readResourceData(file: IReadableFile, buffer: Buffer, filePosition: number): Promise<ResourceData> {
    await file.readAsync(buffer, 0, resourceDataEntryLength, filePosition);
    return {
        dataRva: buffer.readUInt32LE(0),
        size: buffer.readUInt32LE(4),
        codepage: buffer.readUInt32LE(8),
        // reserved: buffer.readUint32LE(12) -- must be 0 according to the spec
    };
}

async function readResourceDirectoryTable(
    file: IReadableFile,
    buffer: Buffer,
    resourceDirectoryFilePosition: number): Promise<ResourceDirectory> {

    interface ResourceDirectoryQueueEntry {
        rva: number;
        directory: ResourceDirectory;
    }

    let root: ResourceDirectory = new ResourceDirectory();
    let queue: ResourceDirectoryQueueEntry[] = [{ rva: 0, directory: root }];

    for (let current = queue.pop(); current !== undefined; current = queue.pop()) {
        let raw = await readRawResourceDirectoryTable(file, buffer, resourceDirectoryFilePosition + current.rva);

        for (let entry of raw.entries) {
            let id: number | string;
            if (entry.integerId !== undefined) {
                id = entry.integerId;
            }
            else {
                id = await readResourceDirectoryString(file, buffer, resourceDirectoryFilePosition + entry.nameOffset);
            }

            let data: ResourceData | ResourceDirectory;
            if (entry.dataEntryOffset) {
                data = await readResourceData(file, buffer, resourceDirectoryFilePosition + entry.dataEntryOffset);
            }
            else {
                let subdirectory: ResourceDirectory = new ResourceDirectory();
                data = subdirectory;
                queue.push({ rva: entry.subdirectoryOffset, directory: subdirectory });
            }

            current.directory.entries.push({ id, data });
        }
    }

    return root;
}

export class ResourceSection {
    constructor(
        public root: ResourceDirectory,
        private file: IReadableFile,
        private sectionTableEntry: SectionTableEntry) {
    }

    public static async load(file: IReadableFile, resourceSectionTableEntry: SectionTableEntry) {
        const buffer = new Buffer(1024);
        buffer.fill(0);

        const root = await readResourceDirectoryTable(
            file,
            buffer,
            resourceSectionTableEntry.pointerToRawData);

        return new ResourceSection(root, file, resourceSectionTableEntry);
    }

    public getResource(...path: (number | string)[]): ResourceData;
    public getResource(): ResourceData {
        const path = arguments;
        let current = this.root;
        // stop one before the end, need to treat it specially.
        let i;
        for (i = 0; i < path.length - 1; ++i) {
            current = current.getSubdirectory(path[i]);
            if (current === undefined) {
                return undefined;
            }
        }

        return current.getDataEntry(path[i]);
    }

    public async getResourceBufferAsync(...path: (number | string)[]): Promise<Buffer>
    public async getResourceBufferAsync(): Promise<Buffer> {
        const resource = this.getResource.apply(this, arguments);
        if (resource === undefined) {
            return undefined;
        }

        const resourceOffset = resource.dataRva - this.sectionTableEntry.virtualAddress;
        const resourceFilePosition = this.sectionTableEntry.pointerToRawData + resourceOffset;

        const buffer = new Buffer(resource.size);
        buffer.fill(0);
        await this.file.readAsync(buffer, 0, resource.size, resourceFilePosition);
        return buffer;
    }
}

export default ResourceSection;
