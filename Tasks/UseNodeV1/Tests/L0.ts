import assert = require('assert');
import os = require('os');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

function runValidations(validator: () => void, tr) {
    try {
        validator();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        throw error;
    }
}

describe('NodeTool Suite', function () {
    this.timeout(60000);

    it('Succeeds when the first download is available', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FirstDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr);
    });

    it('Succeeds when the second download is available', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SecondDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            if (os.platform() === 'win32') {
                assert(tr.succeeded, 'NodeTool should have succeeded.');
                assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            } else {
                assert(tr.failed, 'NodeTool should have failed after the first download failure for non-Windows platforms.');
            }
        }, tr);
    });

    it('Succeeds when the third download is available', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0ThirdDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            if (os.platform() === 'win32') {
                assert(tr.succeeded, 'NodeTool should have succeeded.');
                assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            } else {
                assert(tr.failed, 'NodeTool should have failed after the first download failure for non-Windows platforms.');
            }
        }, tr);
    });

    it('Sets proxy correctly', async () => {
        this.timeout(5000);

        process.env["__proxy__"] = "true";
        let tp: string = path.join(__dirname, 'L0FirstDownloadSuccess.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        delete process.env["__proxy__"];

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
            assert(tr.stdout.indexOf('Setting secret password') > -1, "Password should be set");
            assert(tr.stdout.indexOf('Setting HTTP_PROXY to http://username:password@url.com/') > -1, "Proxy should be set");
        }, tr);
    });

    it('Removes "v" prefixes when evaluating latest version', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0GetsLatestVersion.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTool should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        }, tr);
    });

    it('Uses custom nodejsMirror for index.json and download', async () => {
      this.timeout(5000);

      let tp: string = path.join(__dirname, 'L0CustomMirror.js');
      let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      await tr.runAsync();

      runValidations(() => {
        assert(tr.succeeded, 'NodeTool should have succeeded.');
        assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        assert(tr.stdout.indexOf('REST_GET https://mymirror.example.com/node/index.json') > -1, 'Should fetch index.json from the custom mirror');
        assert(tr.stdout.indexOf('DOWNLOAD https://mymirror.example.com/node/v10.15.1/') > -1, 'Should download from the custom mirror base');
      }, tr);
    });

    it('Reads and trims the version from a file when the version input has its default value', async () => {
      let tp: string = path.join(__dirname, 'L0VersionFromFile.js');
      let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      await tr.runAsync();

      runValidations(() => {
        assert(tr.succeeded, 'NodeTool should have succeeded.');
        assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
        assert(tr.stdOutContained('VERSION_FROM_FILE 20.11.1'), 'NodeTool should use the trimmed version from the file');
      }, tr);
    });

    it('Succeeds without installing Node when no version is supplied', async () => {
      let tp: string = path.join(__dirname, 'L0NoVersion.js');
      let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      await tr.runAsync();

      runValidations(() => {
        assert(tr.succeeded, 'NodeTool should have succeeded.');
        assert(tr.stderr.length === 0, 'NodeTool should not have written to stderr');
      }, tr);
    });

    it('Fails when specified version is invalid', async () => {
      let tp: string = path.join(__dirname, 'L0InvalidVersionSpec.js');
      let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      await tr.runAsync();

      runValidations(() => {
        assert(tr.failed, 'NodeTool should have failed.');
        assert(tr.stdOutContained('loc_mock_InvalidVersionSpecification InvalidFromVersion'), "Descriptive message should be output");
      }, tr);
    });

    it('Fails when version in specified versionSpecFile is invalid', async () => {
      let tp: string = path.join(__dirname, 'L0InvalidVersionSpecInFile.js');
      let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

      await tr.runAsync();

      runValidations(() => {
        assert(tr.failed, 'NodeTool should have failed.');
        assert(tr.stdOutContained('loc_mock_InvalidVersionSpecification InvalidFromFile'), "Descriptive message should be output");
      }, tr);
    });

    for (const fileContents of ['empty', 'whitespace']) {
      it(`Fails when the specified version file is ${fileContents}`, async () => {
        process.env['__versionFileContents__'] = fileContents;
        let tp: string = path.join(__dirname, 'L0EmptyVersionSpecInFile.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        delete process.env['__versionFileContents__'];

        runValidations(() => {
          assert(tr.failed, 'NodeTool should have failed.');
          assert(tr.stdOutContained('loc_mock_VersionFileIsEmpty .node-version'), 'Descriptive message should be output');
        }, tr);
      });
    }
});