import * as tl from 'azure-pipelines-task-lib';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as ltx from 'ltx';

import { applyXdtTransformation } from "../xdttransformationutility";
import { detectFileEncoding } from "../fileencoding";


export function runL1XdtTransformTests(this: Mocha.Suite) {

    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    beforeEach(done => {
        tl.cp(getAbsolutePath('Web.config'), getAbsolutePath('Web_test.config'), '-f', false);
 
        done();
    });
 
    afterEach(done => {
        try {
            tl.rmRF(getAbsolutePath('Web_test.config'));
        }
        catch (error) {
            tl.debug(error);
        }
        finally {
            done();
        }
    });

    it('Runs successfully with XML Transformation (L1)', function(done: Mocha.Done) {
        if (tl.getPlatform() !== tl.Platform.Windows) {
            this.skip();
        }

        applyXdtTransformation(getAbsolutePath('Web_test.config'), getAbsolutePath('Web.Debug.config'));

        const resultFile = readXmlFile(getAbsolutePath('Web_test.config'));
        const expectFile = readXmlFile(getAbsolutePath('Web_Expected.config'));
        assert(ltx.equal(resultFile, expectFile), 'Should Transform attributes on Web.config');
        done();

    });

    function getAbsolutePath(file: string): string {
        return path.join(__dirname, 'L1XdtTransform', file);
    }

    function readXmlFile(path: string): ltx.Element {
        const buffer = fs.readFileSync(path);
        const encoding = detectFileEncoding(path, buffer)[0].toString();
        const xml = buffer.toString(encoding).replace( /(?<!\r)[\n]+/gm, "\r\n" );
        return ltx.parse(xml);
    }
}