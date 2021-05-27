import PEParserError from "./PEParserError";
import VersionInfoVersion from "./VersionInfoVersion";

const neutralLanguageUnicodeCodePage = "000004b0";

export interface RawVsFixedFileInfo {
    signature: number;
    structVersion: number;
    fileVersionMS: number;
    fileVersionLS: number;
    productVersionMS: number;
    productVersionLS: number;
    fileFlagsMask: number;
    fileFlags: number;
    fileOS: number;
    fileType: number;
    fileSubtype: number;
    fileDateMS: number;
    fileDateLS: number;
}

export interface RawVsVersionInfoElement {
    header: RawVsVersionInfoElementHeader;
    rawChildren: RawVsVersionInfoElement[];
}

export interface RawVsVersionInfoElementHeader {
    length: number;
    valueLength: number;
    type: number;
    key: string;

    /** Offset from the beginning of the version resource to the beginning of this header */
    offset: number;

    /** Offset from the beginning of the version resource to the Value field of this element */
    valueOffset: number;

    /** Offset from the beginning of the version resource to the Children field of this element */
    childrenOffset: number;
}

export interface VersionStrings {
    [key: string]: string;

    Comments?: string;
    CompanyName?: string;
    FileDescription?: string;
    FileVersion?: string;
    InternalName?: string;
    LegalCopyright?: string;
    LegalTrademarks?: string;
    OriginalFilename?: string;
    PrivateBuild?: string;
    ProductName?: string;
    ProductVersion?: string;
    SpecialBuild?: string;
}

export interface VersionInfo {
    fileVersion?: VersionInfoVersion;
    productVersion?: VersionInfoVersion;
    strings: VersionStrings;
}

function readNullTerminatedUcs2String(buffer: Buffer, offset: number): { value: string, bytesRead: number } {
    let end = offset;
    while (end < buffer.length - 1) {
        if (buffer.readInt16LE(end) === 0) {
            return { value: buffer.toString("utf16le", offset, end), bytesRead: end - offset + 2 };
        }

        end += 2;
    }

    throw new PEParserError("unterminatedString", "Unterminated string");
}

function roundUp(value: number, multiple: number) {
    const remainder = value % multiple;
    return remainder === 0 ? value : value + multiple - remainder;
}

function readRawVsVersionInfoElementHeader(buffer: Buffer, offset: number): RawVsVersionInfoElementHeader {
    let fixedPartLength = 6;
    let length = buffer.readUInt16LE(offset + 0);
    let key = readNullTerminatedUcs2String(buffer, offset + fixedPartLength);
    let valueOffset = roundUp(offset + fixedPartLength + key.bytesRead, 4);
    let type = buffer.readUInt16LE(offset + 4);
    let valueLength = buffer.readUInt16LE(offset + 2);
    if (type === 1) {
        valueLength *= 2;
    }
    let childrenOffset = roundUp(valueOffset + valueLength, 4);

    return {
        length,
        valueLength,
        type,
        key: key.value,
        offset,
        valueOffset,
        childrenOffset,
    };
}

function readRawVsFixedFileInfo(buffer: Buffer, offset: number): RawVsFixedFileInfo {
    return {
        signature: buffer.readUInt32LE(offset + 0),
        structVersion: buffer.readUInt32LE(offset + 4),
        fileVersionMS: buffer.readUInt32LE(offset + 8),
        fileVersionLS: buffer.readUInt32LE(offset + 12),
        productVersionMS: buffer.readUInt32LE(offset + 16),
        productVersionLS: buffer.readUInt32LE(offset + 20),
        fileFlagsMask: buffer.readUInt32LE(offset + 24),
        fileFlags: buffer.readUInt32LE(offset + 28),
        fileOS: buffer.readUInt32LE(offset + 32),
        fileType: buffer.readUInt32LE(offset + 36),
        fileSubtype: buffer.readUInt32LE(offset + 40),
        fileDateMS: buffer.readUInt32LE(offset + 44),
        fileDateLS: buffer.readUInt32LE(offset + 48),
    };
}

function readRawVsVersionInfoTree(buffer: Buffer, offset: number, depth?: number): RawVsVersionInfoElement {
    if(depth === undefined)
    {
        depth = 0;
    }

    let thisElement: RawVsVersionInfoElement = {
        header: readRawVsVersionInfoElementHeader(buffer, offset),
        rawChildren: [],
    };

    let childOffset = thisElement.header.childrenOffset;
    while (childOffset < offset + thisElement.header.length) {
        let child = readRawVsVersionInfoTree(buffer, childOffset, depth + 1);
        thisElement.rawChildren.push(child);

        childOffset = roundUp(childOffset + child.header.length, 4);
    }

    return thisElement;
}

function processVersionInfoFromTree(root: RawVsVersionInfoElement, buffer: Buffer): VersionInfo {
    let result: VersionInfo = { strings: {} };
    // root should be VS_VERSION_INFO
    if (root.header.key !== "VS_VERSION_INFO") {
        throw "Not a valid version resource";
    }

    if (root.header.valueLength !== 0) {
        let fixedFileInfo = readRawVsFixedFileInfo(buffer, root.header.valueOffset);
        result.fileVersion = VersionInfoVersion.fromDWords(fixedFileInfo.fileVersionMS, fixedFileInfo.fileVersionLS);
        result.productVersion = VersionInfoVersion.fromDWords(
            fixedFileInfo.productVersionMS,
            fixedFileInfo.productVersionLS);
    }

    let stringFileInfoElement = root.rawChildren.find(x => x.header.key === "StringFileInfo");
    if (stringFileInfoElement) {
        let languageNeutralUnicodeStringTableElement = stringFileInfoElement.rawChildren.find(
            x => x.header.key === neutralLanguageUnicodeCodePage);
        if (languageNeutralUnicodeStringTableElement) {
            for (let versionString of languageNeutralUnicodeStringTableElement.rawChildren) {
                result.strings[versionString.header.key] = readNullTerminatedUcs2String(
                    buffer,
                    versionString.header.valueOffset).value;
            }
        }
    }

    return result;
}

export class VersionResource {
    public versionInfo: VersionInfo;
    public rawVersionInfoTree: RawVsVersionInfoElement;

    constructor(buffer: Buffer) {
        this.rawVersionInfoTree = readRawVsVersionInfoTree(buffer, 0);
        this.versionInfo = processVersionInfoFromTree(this.rawVersionInfoTree, buffer);
    }
}

export default VersionResource;
