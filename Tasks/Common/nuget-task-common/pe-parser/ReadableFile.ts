import * as fs from "fs";
import * as Q from "q";

import IReadableFile from "./IReadableFile";

export class ReadableFile implements IReadableFile {
    constructor(public path: string, public fd: number) {
    }

    public static async openAsync(path: string): Promise<ReadableFile> {
        let fd = await Q.nfcall<number>(fs.open, path, "r");
        return new ReadableFile(path, fd);
    }

    public async readAsync(buffer: Buffer, offset: number, length: number, position: number): Promise<number> {
        return Q.nfcall<number>(fs.read, this.fd, buffer, offset, length, position);
    }

    public async closeAsync(): Promise<void> {
        return Q.nfcall<void>(fs.close, this.fd);
    }
}

export default ReadableFile;
