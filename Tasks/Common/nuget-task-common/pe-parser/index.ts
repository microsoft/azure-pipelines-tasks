import IReadableFile from "./IReadableFile";
import PEImageFile from "./PEImageFile";
import PEParserError from "./PEParserError";
import ReadableFile from "./ReadableFile";
import ResourceSection from "./ResourceSection";
import {VersionInfo, VersionResource} from "./VersionResource";

const versionResourceTypeId = 16;
const versionResourceName = 1;
const neutralLanguageId = 0;

export async function getFileVersionInfoAsync(file: string | IReadableFile): Promise<VersionInfo> {
    const readableFile: IReadableFile = typeof file === "string"
        ? await ReadableFile.openAsync(file)
        : file;
    try {
        const peFile = await PEImageFile.readAsync(readableFile);

        const resourceSectionTableEntry = peFile.getSection(".rsrc\0\0\0");
        if (!resourceSectionTableEntry) {
            throw new PEParserError("noResourceSection", "No resource section found in the file");
        }

        const resourceSection = await ResourceSection.load(readableFile, resourceSectionTableEntry);

        const versionResourceBuffer = await resourceSection.getResourceBufferAsync(
            versionResourceTypeId,
            versionResourceName,
            neutralLanguageId);

        if (!versionResourceBuffer) {
            throw new PEParserError("noVersionResource", "No neutral-language version resource found in the file");
        }

        let versionResource = new VersionResource(versionResourceBuffer);
        return versionResource.versionInfo;
    } finally {
        if (typeof file === "string" && readableFile) {
            // we opened the file, so we're responsible for closing it
            await readableFile.closeAsync();
        }
    }

    // this line is unreachable due to the return at the end of the try block, but there's a bug in the TS compiler
    // where it computes reachability incorrectly after the finally block
    // https://github.com/Microsoft/TypeScript/issues/7239
    throw new Error("This line is unreachable.");
}
