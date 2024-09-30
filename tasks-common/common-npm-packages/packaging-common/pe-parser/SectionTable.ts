import IReadableFile from "./IReadableFile";

const sizeOfSectionTableEntry = 40;

export interface SectionTableEntry {
    name: string;
    virtualSize: number;
    virtualAddress: number;
    sizeOfRawData: number;
    pointerToRawData: number;
    pointerToRelocations: number;
    pointerToLinenumbers: number;
    numberOfRelocations: number;
    numberOfLinenumbers: number;
    characteristics: number;
}

async function readSectionTableAsync(
    file: IReadableFile,
    buffer: Buffer,
    filePositionOfSectionTable: number,
    numberOfSections: number): Promise<SectionTableEntry[]> {
    let sections: SectionTableEntry[] = [];
    for (let i = 0; i < numberOfSections; ++i) {
        let filePositionOfEntry = filePositionOfSectionTable + i * sizeOfSectionTableEntry;
        await file.readAsync(buffer, 0, sizeOfSectionTableEntry, filePositionOfEntry);
        sections.push({
            name: buffer.toString("utf8", 0, 8),
            virtualSize: buffer.readUInt32LE(8),
            virtualAddress: buffer.readUInt32LE(12),
            sizeOfRawData: buffer.readUInt32LE(16),
            pointerToRawData: buffer.readUInt32LE(20),
            pointerToRelocations: buffer.readUInt32LE(24),
            pointerToLinenumbers: buffer.readUInt32LE(28),
            numberOfRelocations: buffer.readUInt16LE(32),
            numberOfLinenumbers: buffer.readUInt16LE(34),
            characteristics: buffer.readUInt32LE(36),
        });
    }

    return sections;
}

export class SectionTable {
    constructor(public sections: SectionTableEntry[]) { }

    public static async readAsync(
        file: IReadableFile,
        buffer: Buffer,
        filePositionOfSectionTable: number,
        numberOfSections: number) {
        return new SectionTable(
            await readSectionTableAsync(file, buffer, filePositionOfSectionTable, numberOfSections));
    }

    public getSection(name: string): SectionTableEntry {
        return this.sections.find(x => x.name === name);
    }
}

export default SectionTable;
