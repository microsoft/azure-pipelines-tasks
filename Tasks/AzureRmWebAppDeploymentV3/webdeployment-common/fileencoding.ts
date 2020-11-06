//File Encoding detected to be : utf-32be, which is not supported by Node.js
//'Unable to detect encoding of file ' + typeCode
//'File buffer is too short to detect encoding type'
var fs = require('fs');
import tl = require('azure-pipelines-task-lib');

function detectFileEncodingWithBOM(fileName: string, buffer: Buffer) {
    tl.debug('Detecting file encoding using BOM');
    if(buffer.slice(0,3).equals(new Buffer([239, 187, 191]))) {
        return ['utf-8', true];
    }
    else if(buffer.slice(0,4).equals(new Buffer([255, 254, 0, 0]))) {
        throw Error(tl.loc('EncodeNotSupported', fileName, 'UTF-32LE', 'UTF-32LE'));
    }
    else if(buffer.slice(0,2).equals(new Buffer([254, 255]))) {
        throw Error(tl.loc('EncodeNotSupported', fileName, 'UTF-16BE', 'UTF-16BE'));
    }
    else if(buffer.slice(0,2).equals(new Buffer([255, 254]))) {
        return ['utf-16le', true];
    }
    else if(buffer.slice(0,4).equals(new Buffer([0, 0, 254, 255]))) {
        throw Error(tl.loc('EncodeNotSupported', fileName, 'UTF-32BE', 'UTF-32BE'));
    }
    tl.debug('Unable to detect File encoding using BOM');
    return null;
}

function detectFileEncodingWithoutBOM(fileName: string, buffer: Buffer) {
    tl.debug('Detecting file encoding without BOM');

    var typeCode = 0;
    for(var index = 0; index < 4; index++) {
        typeCode = typeCode << 1;
        typeCode = typeCode | (buffer[index] > 0 ? 1 : 0);
    }
    switch(typeCode) {
        case 1:
            throw Error(tl.loc('EncodeNotSupported', fileName, 'UTF-32BE', 'UTF-32BE'));
        case 5:
            throw Error(tl.loc('EncodeNotSupported', fileName, 'UTF-16BE', 'UTF-16BE'));
        case 8:
            throw Error(tl.loc('EncodeNotSupported', fileName, 'UTF-32LE', 'UTF-32LE'));
        case 10:
            return ['utf-16le', false];
        case 15:
            return ['utf-8', false];
        default:
            throw Error(tl.loc('UnknownFileEncodeError', fileName, typeCode));
    }
}
export function detectFileEncoding(fileName: string, buffer: Buffer) {
    if(buffer.length < 4) {
        throw Error(tl.loc('ShortFileBufferError', fileName));
    }
    var fileEncoding = detectFileEncodingWithBOM(fileName, buffer) || detectFileEncodingWithoutBOM(fileName, buffer);
    return fileEncoding;
}

