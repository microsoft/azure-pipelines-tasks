export interface IReadableFile {
    readAsync(buffer: Buffer, offset: number, length: number, position: number): Promise<number>;
    closeAsync(): Promise<void>;
}

export default IReadableFile;
