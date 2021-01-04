var fileEncoding = require('../fileencoding.js');

var fileEncodeType = fileEncoding.detectFileEncoding('utf-8.txt', new Buffer([239, 187, 191, 0]));
if(fileEncodeType[0] === 'utf-8' && fileEncodeType[1]) {
    console.log('UTF-8 with BOM validated');
}

try {
    var fileEncodeType = fileEncoding.detectFileEncoding('utf-32le.txt', new Buffer([255, 254, 0, 0]));
}
catch(exception) {
    console.log('UTF-32LE with BOM validated');
}

try {
    var fileEncodeType = fileEncoding.detectFileEncoding('utf-16be.txt', new Buffer([254, 255, 0 ,0]));
}
catch(exception) {
    console.log('UTF-16BE with BOM validated');
}

var fileEncodeType = fileEncoding.detectFileEncoding('utf-16le.txt', new Buffer([255, 254, 10, 10]));
if(fileEncodeType[0] === 'utf-16le' && fileEncodeType[1]) {
    console.log('UTF-16LE with BOM validated');
}

try {
    var fileEncodeType = fileEncoding.detectFileEncoding('utf-32BE.txt', new Buffer([0, 0, 254, 255]));
}
catch(exception) {
    console.log('UTF-32BE with BOM validated');
}

var fileEncodeType = fileEncoding.detectFileEncoding('utf-8.txt', new Buffer([10, 11, 12, 13]));
if(fileEncodeType[0] === 'utf-8' && !fileEncodeType[1]) {
    console.log('UTF-8 without BOM validated');
}

try {
    var fileEncodeType = fileEncoding.detectFileEncoding('utf-32le.txt', new Buffer([255, 0, 0, 0]));
}
catch(exception) {
    console.log('UTF-32LE without BOM validated');
}

try {
    var fileEncodeType = fileEncoding.detectFileEncoding('utf-32be.txt', new Buffer([0, 0, 0, 255]));
}
catch(exception) {
    console.log('UTF-32BE without BOM validated');
}

try {
    var fileEncodeType = fileEncoding.detectFileEncoding('utf-16be.txt', new Buffer([0, 10, 0 ,20]));
}
catch(exception) {
    console.log('UTF-16BE without BOM validated');
}

var fileEncodeType = fileEncoding.detectFileEncoding('utf-16le.txt', new Buffer([20, 0, 10, 0]));
if(fileEncodeType[0] === 'utf-16le' && !fileEncodeType[1]) {
    console.log('UTF-16LE without BOM validated');
}

try {
    fileEncoding.detectFileEncoding('utfShort.txt', new Buffer([20, 0]));
}
catch(exception) {
    console.log('Short File Buffer Error');
}

try {
    fileEncoding.detectFileEncoding('utfUnknown.txt', new Buffer([0, 10, 20, 30]));
}
catch(exception) {
    console.log('Unknown encoding type')
}