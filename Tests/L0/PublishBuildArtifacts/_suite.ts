/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import os = require('os');
import psm = require('../../lib/psRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Publish Build Artifacts Suite', function () {
    this.timeout(10000);
	
	before((done: MochaDone) => {
		// init here
		done();
	});

	after(() => {
	});
	
	it('Publish to container', (done: MochaDone) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		let tr = new trm.TaskRunner('PublishBuildArtifacts');
		tr.setInput('PathtoPublish', '/bin/release');
		tr.setInput('ArtifactName', 'drop');
		tr.setInput('ArtifactType', 'Container');
		
		tr.run()
		.then(() => {
			assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
			assert(tr.stdout.search(/##vso\[artifact.upload artifactType=container;artifactName=drop;containerfolder=drop;localpath=\/bin\/release;\]\/bin\/release/gi) >= 0, 'should publish artifact.');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	

	if (os.platform() == 'win32') {
		it('Publish to UNC', (done: MochaDone) => {
			setResponseFile('publishBuildArtifactsGood.json');

			let tr = new trm.TaskRunner('PublishBuildArtifacts', false, true);
			tr.setInput('PathtoPublish', 'C:\\bin\\release');
			tr.setInput('ArtifactName', 'drop');
			tr.setInput('ArtifactType', 'FilePath');
			tr.setInput('TargetPath', '\\\\UNCShare\\subdir');

			tr.run()
			.then(() => {
				assert(!tr.stderr, 'should not have written to stderr. error: ' + tr.stderr);
				assert(tr.succeeded, 'task should have succeeded');
				assert(tr.stdout.indexOf('test stdout from robocopy (no trailing slashes)') >= 0, 'should copy files.');
				assert(tr.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
				done();
			})
			.fail((err) => {
				done(err);
			});
		})

		it('Appends . to robocopy source with trailing slash', (done: MochaDone) => {
			setResponseFile('publishBuildArtifactsGood.json');

			let tr = new trm.TaskRunner('PublishBuildArtifacts', false, true);
			tr.setInput('PathtoPublish', 'C:\\bin\\release\\');
			tr.setInput('ArtifactName', 'drop');
			tr.setInput('ArtifactType', 'FilePath');
			tr.setInput('TargetPath', '\\\\UNCShare\\subdir');

			tr.run()
			.then(() => {
				assert(!tr.stderr, 'should not have written to stderr. error: ' + tr.stderr);
				assert(tr.succeeded, 'task should have succeeded');
				assert(tr.stdout.indexOf('test stdout from robocopy (source with trailing slash)') >= 0, 'should copy files.');
				assert(tr.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
				done();
			})
			.fail((err) => {
				done(err);
			});
		})

		it('Appends . to robocopy target with trailing slash', (done: MochaDone) => {
			setResponseFile('publishBuildArtifactsGood.json');

			let tr = new trm.TaskRunner('PublishBuildArtifacts', false, true);
			tr.setInput('PathtoPublish', 'C:\\bin\\release');
			tr.setInput('ArtifactName', 'drop');
			tr.setInput('ArtifactType', 'FilePath');
			tr.setInput('TargetPath', '\\\\UNCShare');

			tr.run()
			.then(() => {
				assert(!tr.stderr, 'should not have written to stderr. error: ' + tr.stderr);
				assert(tr.succeeded, 'task should have succeeded');
				assert(tr.stdout.indexOf('test stdout from robocopy (target with trailing slash)') >= 0, 'should copy files.');
				assert(tr.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
				done();
			})
			.fail((err) => {
				done(err);
			});
		})

		it('fails if robocopy fails', (done: MochaDone) => {
			setResponseFile('publishBuildArtifactsBad.json');
			
			let tr = new trm.TaskRunner('PublishBuildArtifacts', false, true);
			tr.setInput('PathtoPublish', 'C:\\bin\\release');
			tr.setInput('ArtifactName', 'drop');
			tr.setInput('ArtifactType', 'FilePath');
			tr.setInput('TargetPath', '\\\\UNCShare\\subdir');
			
			tr.run()
			.then(() => {
				assert(tr.failed, 'task should have failed');
				assert(tr.stdout.match(/test stdout from robocopy/gi).length === 1, 'should call robocopy.');
				assert(tr.stdout.search(/artifact.associate/gi) >= 0, 'should associate artifact.');
				done();
			})
			.fail((err) => {
				done(err);
			});
		})

		it('creates filepath artifact', (done: MochaDone) => {
			setResponseFile('publishBuildArtifactsGood.json');

			let tr = new trm.TaskRunner('PublishBuildArtifacts', false, true);
			tr.setInput('PathtoPublish', 'C:\\bin\\release');
			tr.setInput('ArtifactName', 'drop');
			tr.setInput('ArtifactType', 'FilePath');
			tr.setInput('TargetPath', '\\\\UNCShare\\subdir');

			tr.run()
			.then(() => {
				assert(!tr.stderr, 'should not have written to stderr. error: ' + tr.stderr);
				assert(tr.succeeded, 'task should have succeeded');
				assert(tr.stdout.indexOf('##vso[artifact.associate artifacttype=filepath;artifactname=drop;artifactlocation=\\\\UNCShare\\subdir;]\\\\UNCShare\\subdir') >= 0, 'should associate artifact.');
				done();
			})
			.fail((err) => {
				done(err);
			});
		})
	}
	else {
		it('fails to create filepath artifact', (done: MochaDone) => {
			setResponseFile('publishBuildArtifactsGood.json');

			let tr = new trm.TaskRunner('PublishBuildArtifacts', false, true);
			tr.setInput('PathtoPublish', '/bin/release');
			tr.setInput('ArtifactName', 'drop');
			tr.setInput('ArtifactType', 'FilePath');
			tr.setInput('TargetPath', '\\\\UNCShare\\subdir');

			tr.run()
			.then(() => {
				assert(tr.stderr.match(/Cannot publish artifacts from an OSX or Linux agent to a file share/), 'should have written error message');
				assert(tr.failed, 'task should have succeeded');
				assert(tr.stdout.indexOf('##vso[artifact.associate') < 0, 'should not associate artifact.');
				done();
			})
			.fail((err) => {
				done(err);
			});
		})
	}

	it('fails if PathtoPublish not set', (done: MochaDone) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		let tr = new trm.TaskRunner('PublishBuildArtifacts');		
		tr.setInput('ArtifactName', 'drop');
		tr.setInput('ArtifactType', 'Container');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: PathtoPublish'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running PublishBuildArtifacts');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if ArtifactName not set', (done: MochaDone) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		let tr = new trm.TaskRunner('PublishBuildArtifacts');
		tr.setInput('PathtoPublish', '/bin/release');
		tr.setInput('ArtifactType', 'Container');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: ArtifactName'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running PublishBuildArtifacts');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if ArtifactType not set', (done: MochaDone) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		let tr = new trm.TaskRunner('PublishBuildArtifacts');
		tr.setInput('PathtoPublish', '/bin/release');
		tr.setInput('ArtifactName', 'drop');
		tr.run()
		.then(() => {
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
			assert(tr.stdErrContained('Input required: ArtifactType'));
            assert(tr.failed, 'task should have failed');
            assert(tr.invokedToolCount == 0, 'should exit before running PublishBuildArtifacts');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	
	it('fails if PathtoPublish not found', (done: MochaDone) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		let tr = new trm.TaskRunner('PublishBuildArtifacts');
		tr.setInput('PathtoPublish', '/bin/notexist');
		tr.setInput('ArtifactName', 'drop');
		tr.setInput('ArtifactType', 'Container');
		tr.run()
		.then(() => {
			assert(tr.failed, 'should have failed');
            let expectedErr = 'not found PathtoPublish';
            assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.invokedToolCount == 0, 'should exit before running PublishBuildArtifacts');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
});