import * as assert from 'assert';
import { detectFileEncoding } from '../fileencoding';

export function runL1ValidateFileEncodingTests(this: Mocha.Suite): void {

    it("UTF-8 with BOM", () => {
        const fileEncodeType = detectFileEncoding('utf-8.txt', Buffer.from([239, 187, 191, 0]));
        assert.strictEqual(fileEncodeType[0], 'utf-8');
        assert.strictEqual(fileEncodeType[1], true);
    });

    it("UTF-32LE with BOM", () => {
        assert.throws(() => detectFileEncoding('utf-32le.txt', Buffer.from([255, 254, 0, 0])));
    });

    it("UTF-16BE with BOM", () => {
        assert.throws(() => detectFileEncoding('utf-16be.txt', Buffer.from([254, 255, 0, 0])));
    });

    it("UTF-16LE with BOM", () => {
        const fileEncodeType = detectFileEncoding('utf-16le.txt', Buffer.from([255, 254, 10, 10]));
        assert.strictEqual(fileEncodeType[0], 'utf-16le');
        assert.strictEqual(fileEncodeType[1], true);
    });

    it("UTF-32BE with BOM", () => {
        assert.throws(() => detectFileEncoding('utf-32BE.txt', Buffer.from([0, 0, 254, 255])));
    });

    it("UTF-8 without BOM", () => {
        const fileEncodeType = detectFileEncoding('utf-8.txt', Buffer.from([10, 11, 12, 13]));
        assert.strictEqual(fileEncodeType[0], 'utf-8');
        assert.strictEqual(fileEncodeType[1], false);
    });

    it("UTF-32LE without BOM", () => {
        assert.throws(() => detectFileEncoding('utf-32le.txt', Buffer.from([255, 0, 0, 0])));
    });

    it("UTF-32BE without BOM", () => {
        assert.throws(() => detectFileEncoding('utf-32be.txt', Buffer.from([0, 0, 0, 255])));
    });

    it("UTF-16BE without BOM", () => {
        assert.throws(() => detectFileEncoding('utf-16be.txt', Buffer.from([0, 10, 0 ,20])));
    });

    it("UTF-16LE without BOM", () => {
        const fileEncodeType = detectFileEncoding('utf-16le.txt', Buffer.from([20, 0, 10, 0]));
        assert.strictEqual(fileEncodeType[0], 'utf-16le');
        assert.strictEqual(fileEncodeType[1], false);
    });

    it("Short File Buffer Error", () => {
        assert.throws(() => detectFileEncoding('utfShort.txt', Buffer.from([20, 0])));
    });

    it("Unknown encoding type", () => {
        assert.throws(() => detectFileEncoding('utfUnknown.txt', Buffer.from([0, 10, 20, 30])));
    });
} 
