/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Delete Files Suite', function() {
    this.timeout(10000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});	

    it('build cleanup mode does not skip if does not contain 000Admin directory', (done) => {
        setResponseFile('buildCleanupNotSkipResponses.json');
        var tr = new trm.TaskRunner('DeleteFiles');
        tr.setInput('SourceFolder', '/someDir');
        tr.setInput('Contents', '**');
        tr.setInput('BuildCleanup', 'true');
        tr.run()
        .then(() => {
            assert(tr.stdout.indexOf('rmRF(/someDir/someNestedDir)') >= 0, 'task should have deleted nested dir');
            assert(tr.stdout.indexOf('rmRF(/someDir/someFile)') >= 0, 'task should have deleted nested file');
            assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    it('build cleanup mode skips if contains 000Admin directory', (done) => {
        setResponseFile('buildCleanupSkipResponses.json');
        var tr = new trm.TaskRunner('DeleteFiles');
        tr.setInput('SourceFolder', '/someDir');
        tr.setInput('Contents', '**');
        tr.setInput('BuildCleanup', 'true');
        tr.run()
        .then(() => {
            assert(tr.stdout.match(/type=warning;]Skipping delete for symbol store file share/gi), 'task should have skipped symbol store share');
            assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

    it('build cleanup mode skips if contains nested 000Admin directory', (done) => {
        setResponseFile('buildCleanupSkip2Responses.json');
        var tr = new trm.TaskRunner('DeleteFiles');
        tr.setInput('SourceFolder', '/someDir');
        tr.setInput('Contents', '**');
        tr.setInput('BuildCleanup', 'true');
        tr.run()
        .then(() => {
            assert(tr.stdout.match(/type=warning;]Skipping delete for symbol store file share/gi), 'task should have skipped symbol store share');
            assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        });
    })

	it('runs deleteFiles on single folder', (done) => {
		setResponseFile('deleteFilesResponsesGood.json');
		
		var tr = new trm.TaskRunner('DeleteFiles');
		tr.setInput('SourceFolder', '/someDir');
		tr.setInput('Contents', 'someOtherDir');
		
		tr.run()
		.then(() => {
			assert(tr.stdout.indexOf('rmRF(/someDir/someOtherDir)') >= 0, 'task should have deleted someOtherDir');
			assert(tr.stdout.indexOf('rmRF(/someDir/someOtherDir2)') < 0, 'task should not have deleted someOtherDir2');
			assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
	
	it('runs deleteFiles on multiple folders', (done) => {
		setResponseFile('deleteFilesResponsesMultiPatternGood.json');
		
		var tr = new trm.TaskRunner('DeleteFiles');
		tr.setInput('SourceFolder', '/someDir');
		tr.setInput('Contents', 'someOtherDir\nsomeOtherDir2');
		
		tr.run()
		.then(() => {
			assert(tr.stdout.indexOf('rmRF(/someDir/someOtherDir)') >= 0, 'task should have deleted someOtherDir');
			assert(tr.stdout.indexOf('rmRF(/someDir/someOtherDir2)') >= 0, 'task should have deleted someOtherDir2');
			assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
	
	it('runs deleteFiles on locked folder', (done) => {
		setResponseFile('deleteFilesResponsesBad.json');
		
		var tr = new trm.TaskRunner('DeleteFiles');
		tr.setInput('SourceFolder', '/lockedDir');
		tr.setInput('Contents', 'otherLockedDir');
		
		tr.run()
		.then(() => {
			assert(tr.stderr.length > 0, 'should have written to stderr. error: ' + tr.stderr);
            assert(!tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})

	it('fails if Contents not set', (done) => {
		setResponseFile('deleteFilesResponsesGood.json');
		
		var tr = new trm.TaskRunner('DeleteFiles');
		tr.setInput('SourceFolder', '/srcDir');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: Contents'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running DeleteFiles');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if SourceFolder not set', (done) => {
		setResponseFile('deleteFilesResponsesGood.json');
		
		var tr = new trm.TaskRunner('DeleteFiles');
		tr.setInput('Contents', '**');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: SourceFolder'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running DeleteFiles');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('succeeds if SourceFolder not found', (done) => {
		setResponseFile('deleteFilesResponsesGood.json');
		
		var tr = new trm.TaskRunner('DeleteFiles');
		tr.setInput('Contents', '**');
        tr.setInput('SourceFolder', '/notExistDir');
		tr.run()
		.then(() => {
			assert(tr.succeeded, 'should have succeeded');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running DeleteFiles');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});