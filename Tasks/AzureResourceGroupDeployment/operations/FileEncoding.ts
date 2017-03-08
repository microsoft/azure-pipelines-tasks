//File Encoding detected to be : utf-32be, which is not supported by Node.js
//'Unable to detect encoding of file ' + typeCode
//'File buffer is too short to detect encoding type'
var fs = require('fs');
import tl = require('vsts-task-lib');

export class FileEncoding {
    public type: string;
    public usesBOM: boolean;
    constructor(type: string, usesBOM: boolean) {
        this.type = type;
        this.usesBOM = usesBOM;
    }
}

function detectFileEncodingWithBOM(fileName: string, buffer: Buffer) {
    tl.debug('Detecting file encoding using BOM');
    var type: string;
    if (buffer.slice(0, 3).equals(new Buffer([239, 187, 191]))) {
        type = 'utf-8';
    }
    else if (buffer.slice(0, 4).equals(new Buffer([255, 254, 0, 0]))) {
        type = 'UTF-32LE';
    }
    else if (buffer.slice(0, 2).equals(new Buffer([254, 255]))) {
        type = 'UTF-16BE';
    }
    else if (buffer.slice(0, 2).equals(new Buffer([255, 254]))) {
        type = 'utf-16le';
    }
    else if (buffer.slice(0, 4).equals(new Buffer([0, 0, 254, 255]))) {
        type = 'UTF-32BE';
    }
    else {
        tl.debug('Unable to detect File encoding using BOM');
        return null;
    }
    return new FileEncoding(type, true);
}

function detectFileEncodingWithoutBOM(fileName: string, buffer: Buffer) {
    tl.debug('Detecting file encoding without BOM');
    var typeCode = 0;
    var type: string;
    for (var index = 0; index < 4; index++) {
        typeCode = typeCode << 1;
        typeCode = typeCode | (buffer[index] > 0 ? 1 : 0);
    }
    switch (typeCode) {
        case 1:
            type = 'UTF-32BE';
            break;
        case 5:
            type = 'UTF-16BE';
            break;
        case 8:
            type = 'UTF-32LE';
            break;
        case 10:
            type = 'utf-16le';
            break;
        case 15:
            type = 'utf-8';
            break;
        default:
            return null;
    }
    return new FileEncoding(type, false);
}
export function detectFileEncoding(fileName: string, buffer: Buffer): FileEncoding {
    if (buffer.length < 4) {
        throw Error(tl.loc('ShortFileBufferError', fileName));
    }
    var fileEncoding: FileEncoding = detectFileEncodingWithBOM(fileName, buffer);
    if (fileEncoding == null)
        fileEncoding = detectFileEncodingWithoutBOM(fileName, buffer);

    if (fileEncoding == null) {
        throw new Error(tl.loc("CouldNotDetectEncoding"));
    }
    return fileEncoding;
}

export function readFileContentsAsText(fileName: string): string {
    var buffer = fs.readFileSync(fileName);
    var supportedFileEncodings = ["utf-8", "utf-16le"]
    var fileEncoding = detectFileEncoding(fileName, buffer);
    if (supportedFileEncodings.indexOf(fileEncoding.type) < 0) {
        throw new Error(tl.loc('EncodingNotSupported', fileEncoding.type, fileName));
    }
    var fileContents: string = buffer.toString(fileEncoding.type);
    if (fileEncoding.usesBOM) {
        fileContents = fileContents.slice(1);
    }
    return fileContents;
}