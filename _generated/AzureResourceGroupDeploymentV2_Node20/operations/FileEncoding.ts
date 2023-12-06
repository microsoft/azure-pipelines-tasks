//File Encoding detected to be : utf-32be, which is not supported by Node.js
//'Unable to detect encoding of file ' + typeCode
//'File buffer is too short to detect encoding type'

var fs = require('fs');
import tl = require('azure-pipelines-task-lib');

export class FileEncoding {
    public type: string;
    public usesBOM: boolean;
    constructor(type: string, usesBOM: boolean) {
        this.type = type;
        this.usesBOM = usesBOM;
    }
}

function detectFileEncodingWithBOM(buffer: Buffer): FileEncoding {
    tl.debug('Detecting file encoding using BOM');
    var type: string;
    if (buffer.slice(0, 3).equals(new Buffer([239, 187, 191]))) {
        type = 'utf-8';
    }
    else if (buffer.slice(0, 4).equals(new Buffer([255, 254, 0, 0]))) {
        type = 'utf-32le';
    }
    else if (buffer.slice(0, 2).equals(new Buffer([254, 255]))) {
        type = 'utf-16be';
    }
    else if (buffer.slice(0, 2).equals(new Buffer([255, 254]))) {
        type = 'utf-16le';
    }
    else if (buffer.slice(0, 4).equals(new Buffer([0, 0, 254, 255]))) {
        type = 'utf-32be';
    }
    else {
        tl.debug('Unable to detect File encoding using BOM');
        return null;
    }
    return new FileEncoding(type, true);
}

function detectFileEncodingWithoutBOM(buffer: Buffer): FileEncoding {
    tl.debug('Detecting file encoding without BOM');

    var typeCode = 0;
    var type: string;
    var codeForUtf8 = 0
    for (var index = 0; index < 4 && index < buffer.length; index++) {
        typeCode = typeCode << 1;
        typeCode = typeCode | (buffer[index] > 0 ? 1 : 0);
        codeForUtf8 = codeForUtf8 << 1;
        codeForUtf8++;
    }
    switch (typeCode) {
        case 1:
            type = 'utf-32be';
            break;
        case 5:
            type = 'utf-16be';
            break;
        case 8:
            type = 'utf-32le';
            break;
        case 10:
            type = 'utf-16le';
            break;
        default:
            if (codeForUtf8 == typeCode) {
                type = 'utf-8';
            }
            else {
                return null;
            }
    }
    return new FileEncoding(type, false);
}
export function detectFileEncoding(fileName: string, buffer: Buffer): FileEncoding {
    var fileEncoding: FileEncoding = detectFileEncodingWithBOM(buffer);
    if (fileEncoding == null) {
        if (buffer.length < 4) {
            tl.debug('Short file buffer error on file' + fileName + '. length: ' + buffer.length);
        }
        fileEncoding = detectFileEncodingWithoutBOM(buffer);
    }

    if (fileEncoding == null) {
        throw new Error(tl.loc("CouldNotDetectEncoding", fileName));
    }
    console.log(tl.loc("DetectedFileEncoding", fileName, fileEncoding.type));
    return fileEncoding;
}

export function readFileContentsAsText(fileName: string): string {
    var buffer = fs.readFileSync(fileName);
    var supportedFileEncodings = ["utf-8", "utf-16le"]
    var fileEncoding = detectFileEncoding(fileName, buffer);
    if (supportedFileEncodings.indexOf(fileEncoding.type) < 0) {
        throw new Error(tl.loc('EncodingNotSupported', fileName, fileEncoding.type));
    }
    var fileContents: string = buffer.toString(fileEncoding.type);
    if (fileEncoding.usesBOM) {
        fileContents = fileContents.slice(1);
    }
    return fileContents;
}