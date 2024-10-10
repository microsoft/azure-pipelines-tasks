import * as path from 'path';
import * as assert from 'assert';
import * as ltx from 'ltx';
import * as fs from 'fs';

import * as tl from 'azure-pipelines-task-lib';

import { substituteXmlVariables } from '../xmlvariablesubstitutionutility';
import { detectFileEncoding } from "../fileencoding";

export function runL1XmlVarSubTests(this: Mocha.Suite): void {

    this.timeout(60000);

    beforeEach(function (done: Mocha.Done) {
        tl.cp(getAbsolutePath('Web.config'), getAbsolutePath('Web_test.config'), '-f', false);
        tl.cp(getAbsolutePath('Web.Debug.config'), getAbsolutePath('Web_test.Debug.config'), '-f', false);
        tl.cp(getAbsolutePath('parameters.xml'), getAbsolutePath('parameters_test.xml'), '-f', false);

        done();
    });

    afterEach(done => {
        try {
            tl.rmRF(getAbsolutePath('parameters_test.xml'));
            tl.rmRF(getAbsolutePath('Web_test.Debug.config'));
            tl.rmRF(getAbsolutePath('Web_test.config'));
        }
        catch (error) {
            tl.debug(error);
        }
        finally {
            done();
        }
    });

    it("Runs successfully with XML variable substitution", done => {
        const parameterFilePath = getAbsolutePath('parameters_test.xml');
        const tags = ["applicationSettings", "appSettings", "connectionStrings", "configSections"];
        const variableMap = {
            'conntype': 'new_connType',
            "MyDB": "TestDB",
            'webpages:Version': '1.1.7.3',
            'xdt:Transform': 'DelAttributes',
            'xdt:Locator': 'Match(tag)',
            'DefaultConnection': "Url=https://primary;Database=db1;ApiKey=11111111-1111-1111-1111-111111111111;Failover = {Url:'https://secondary', ApiKey:'11111111-1111-1111-1111-111111111111'}",
            'OtherDefaultConnection': 'connectionStringValue2',
            'ParameterConnection': 'New_Connection_String From xml var subs',
            'connectionString': 'replaced_value',
            'invariantName': 'System.Data.SqlServer',
            'blatvar': 'ApplicationSettingReplacedValue',
            'log_level': 'error,warning',
            'Email:ToOverride': ''
        };

        substituteXmlVariables(getAbsolutePath('Web_test.config'), tags, variableMap, parameterFilePath);
        substituteXmlVariables(getAbsolutePath('Web_test.Debug.config'), tags, variableMap, parameterFilePath);

        assert(compareXmlFiles('Web_test.config', 'Web_Expected.config'), 'Should have substituted variables in Web.config file');
        assert(compareXmlFiles('Web_test.Debug.config', 'Web_Expected.Debug.config'), 'Should have substituted variables in Web.Debug.config file');
        assert(compareXmlFiles('parameters_test.xml', 'parameters_Expected.xml'), 'Should have substituted variables in parameters.xml file');

        done();
    });

    function getAbsolutePath(file: string): string {
        return path.join(__dirname, 'L1XmlVarSub', file);
    }

    function compareXmlFiles(actualFile: string, expectedFile: string): boolean {
        const actualFilePath = getAbsolutePath(actualFile);
        const expectedFilePath = getAbsolutePath(expectedFile);

        var actualXml = ltx.parse(readFile(actualFilePath));
        var expectedXml = ltx.parse(readFile(expectedFilePath));

        return ltx.equal(actualXml, expectedXml);
    }

    function readFile(path: string): string {
        const buffer = fs.readFileSync(path);
        const encoding = detectFileEncoding(path, buffer)[0].toString();
        return buffer.toString(encoding).replace(/(?<!\r)[\n]+/gm, "\r\n");
    }
}

