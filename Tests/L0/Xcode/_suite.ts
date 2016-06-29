/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Xcode Suite', function() {

	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	it('Xcode builds a workspace', (done) => {
		this.timeout(500);
		setResponseFile('responseGoodBuild.json');
		var tr = new trm.TaskRunner('Xcode');
		tr.setInput('actions', 'build');
		tr.setInput('configuration', 'Release');
		tr.setInput('sdk', 'iphoneos');
		tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
		tr.setInput('packageApp', 'false');
		tr.setInput('outputPattern', 'output/iphoneos/Release');
		tr.run()
			.then(() => {
				assert(tr.ran('/home/bin/xcodebuild -version'), 'version check should have been run');
				assert(tr.ran('/home/bin/xcodebuild -sdk iphoneos -configuration Release ' +
						'-workspace /user/build/fun.xcodeproj/project.xcworkspace build ' +
						'DSTROOT=/mockSrcDir/output/iphoneos/Release/build.dst ' +
						'OBJROOT=/mockSrcDir/output/iphoneos/Release/build.obj ' +
						'SYMROOT=/mockSrcDir/output/iphoneos/Release/build.sym ' +
						'SHARED_PRECOMPS_DIR=/mockSrcDir/output/iphoneos/Release/build.pch'),
					'it should have run xcodebuild');
				assert(tr.invokedToolCount == 2, 'should have only run 2 commands');
				assert(tr.resultWasSet, 'task should have set a result');
				assert(tr.stderr.length == 0, 'should not have written to stderr: ' + tr.stderr + ' stdout = ' + tr.stdout);
				assert(tr.succeeded, 'task should have succeeded');
				done();
			})
			.fail((err) => {
				done(err);
			});
	})
});
