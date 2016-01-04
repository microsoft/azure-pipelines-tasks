/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Publish Build Artifacts Suite', function() {
    this.timeout(10000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});	
	
	it('Publish to container', (done) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		var tr = new trm.TaskRunner('PublishBuildArtifacts');
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
	
	it('Publish to UNC', (done) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		var tr = new trm.TaskRunner('PublishBuildArtifacts');
		tr.setInput('PathtoPublish', '/bin/release');
		tr.setInput('ArtifactName', 'drop');
		tr.setInput('ArtifactType', 'FilePath');
		tr.setInput('TargetPath', '\\\\UNCShare');
		
		tr.run()
		.then(() => {
			assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
			assert(tr.stdout.match(/###copying###/gi).length === 1, 'should copy files.');
			assert(tr.stdout.search(/##vso\[artifact.associate artifactType=filepath;artifactName=drop;artifactlocation=\\\\UNCShare;\]\\\\UNCShare/gi) >= 0, 'should associate artifact.');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
	
	it('fails if PathtoPublish not set', (done) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		var tr = new trm.TaskRunner('PublishBuildArtifacts');		
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
	
	it('fails if ArtifactName not set', (done) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		var tr = new trm.TaskRunner('PublishBuildArtifacts');
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
	
	it('fails if ArtifactType not set', (done) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		var tr = new trm.TaskRunner('PublishBuildArtifacts');
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
	
	
	it('fails if PathtoPublish not found', (done) => {
		setResponseFile('publishBuildArtifactsGood.json');
		
		var tr = new trm.TaskRunner('PublishBuildArtifacts');
		tr.setInput('PathtoPublish', '/bin/notexist');
		tr.setInput('ArtifactName', 'drop');
		tr.setInput('ArtifactType', 'Container');
		tr.run()
		.then(() => {
			assert(tr.failed, 'should have failed');
            var expectedErr = 'not found PathtoPublish';
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