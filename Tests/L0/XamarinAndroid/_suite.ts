/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
	process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('XamarinAndroid Suite', function() {
    this.timeout(20000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});
	
	it('run XamarinAndroid with all default inputs', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Single*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project.csproj /t:PackageForAndroid'), 'it should have run xamarin android');
            assert(tr.invokedToolCount == 1, 'should have only run XamarinAndroid 1 time');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
    
	it('run XamarinAndroid with project missing', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		//tr.setInput('project', '**/*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinAndroid');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
			assert(tr.stderr.indexOf('Input required: project') >= 0, 'wrong error message: "' + tr.stderr + '"');			
			done();
		})
		.fail((err) => {
			done(err);
		});
	})    
    
	it('run XamarinAndroid where project does not match anything', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/home*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinAndroid');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
			assert(tr.stdout.indexOf('##vso[task.issue type=error;]No matching files were found with search pattern:') >= 0, 'wrong error message: "' + tr.stderr + '"');			
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
        
	it('run XamarinAndroid where project is a single file', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '/user/build/fun/project.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project.csproj /t:PackageForAndroid'), 'it should have run xamarin android');
            assert(tr.invokedToolCount == 1, 'should have only run XamarinAndroid 1 time');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
        
	it('run XamarinAndroid where project is a single file that does not exist', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '/user/build/fun/project2.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinAndroid');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
			assert(tr.stderr.indexOf('not found files: /user/build/fun/project2.csproj') >= 0, 'wrong error message: "' + tr.stderr + '"');			
			done();
		})
		.fail((err) => {
			done(err);
		});
	})    
    
	it('run XamarinAndroid where project matches multiple files', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Multiple*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project1.csproj /t:PackageForAndroid'), 'it should have run xamarin android 1');
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project2.csproj /t:PackageForAndroid'), 'it should have run xamarin android 2');
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project3.csproj /t:PackageForAndroid'), 'it should have run xamarin android 3');
            assert(tr.invokedToolCount == 3, 'should have only run XamarinAndroid 3 times');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})    
    
	it('run XamarinAndroid with jdkVersion set to 1.8', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Single*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', '1.8');
		tr.setInput('jdkArchitecture', 'x86');
		
		tr.run()
		.then(() => {
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project.csproj /t:PackageForAndroid /p:JavaSdkDirectory=/user/local/bin/Java8'), 'it should have run xamarin android');
            assert(tr.invokedToolCount == 1, 'should have only run XamarinAndroid 1 time');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
	
	it('fails with jdkVersion set to 1.5', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Single*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', '1.5');
		tr.setInput('jdkArchitecture', 'x86');
		
		tr.run()
		.then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinAndroid');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Failed to find specified JDK version') >= 0, 'JAVA_HOME set?');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})	
    
	it('run XamarinAndroid with all default inputs', (done) => {
        // Not using a response file so that xbuild won't be found
		setResponseFile('responseEmpty.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Single*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinAndroid');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('##vso[task.issue type=error;]xbuild was not found in the path') >= 0, 'JAVA_HOME set?');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
    
	it('run XamarinAndroid with msbuildlocation provided', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Single*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '/home/bin2/');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');

		tr.run()
		.then(() => {
            // Note: in the response file we have checkPath returning true for /home/bin2/xbuild.exe
            //       This means that the tool path will contain the .exe extension and so we have to 
            //       check for this below.		
            assert(tr.ran('/home/bin2/xbuild.exe /user/build/fun/project.csproj /t:PackageForAndroid'), 'it should have run xamarin android');
            assert(tr.invokedToolCount == 1, 'should have only run XamarinAndroid 1 time');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
    
	it('run XamarinAndroid with INVALID msbuildlocation', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Single*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '/home/bin/INVALID');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
            assert(tr.invokedToolCount == 0, 'should not have run XamarinAndroid');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length > 0, 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            assert(tr.stderr.indexOf('not found xbuild:') >= 0, 'xbuild tool path found?');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
        
	it('run XamarinAndroid with ALL args provided', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Single*.csproj');
		tr.setInput('target', '"My Target"');
		tr.setInput('clean', 'true');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '"/home/o u t/dir"');
		tr.setInput('configuration', '"For Release"');
		tr.setInput('msbuildArguments', '/m:1 "/p:temp=/home/temp dir/" /f');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', '1.8');
		tr.setInput('jdkArchitecture', 'x86');
		
		tr.run()
		.then(() => {
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project.csproj /t:Clean /t:My Target /t:PackageForAndroid /m:1 /p:temp=/home/temp dir/ /f /p:OutputPath=/home/o u t/dir /p:Configuration=For Release /p:JavaSdkDirectory=/user/local/bin/Java8'), 'it should have run xamarin android');
            assert(tr.invokedToolCount == 1, 'should have only run XamarinAndroid 1 time');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})
    
	it('run XamarinAndroid with multiple projects and ALL args provided', (done) => {
		setResponseFile('response.json');
		
		var tr = new trm.TaskRunner('XamarinAndroid', true);
		tr.setInput('project', '**/Multiple*.csproj');
		tr.setInput('target', '"My Target"');
		tr.setInput('clean', 'true');
		tr.setInput('createAppPackage', 'true');
		tr.setInput('outputDir', '"/home/o u t/dir"');
		tr.setInput('configuration', '"For Release"');
		tr.setInput('msbuildArguments', '/m:1 "/p:temp=/home/temp dir/" /f');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', '1.8');
		tr.setInput('jdkArchitecture', 'x86');
		
		tr.run()
		.then(() => {
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project1.csproj /t:Clean /t:My Target /t:PackageForAndroid /m:1 /p:temp=/home/temp dir/ /f /p:OutputPath=/home/o u t/dir /p:Configuration=For Release /p:JavaSdkDirectory=/user/local/bin/Java8'), 'it should have run xamarin android 1');
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project2.csproj /t:Clean /t:My Target /t:PackageForAndroid /m:1 /p:temp=/home/temp dir/ /f /p:OutputPath=/home/o u t/dir /p:Configuration=For Release /p:JavaSdkDirectory=/user/local/bin/Java8'), 'it should have run xamarin android 2');
            assert(tr.ran('/home/bin/xbuild /user/build/fun/project3.csproj /t:Clean /t:My Target /t:PackageForAndroid /m:1 /p:temp=/home/temp dir/ /f /p:OutputPath=/home/o u t/dir /p:Configuration=For Release /p:JavaSdkDirectory=/user/local/bin/Java8'), 'it should have run xamarin android 3');
            assert(tr.invokedToolCount == 3, 'should have only run XamarinAndroid 3 times');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
			done();
		})
		.fail((err) => {
			done(err);
		});
	})

	it('XamarinAndroid do not create app package', (done:MochaDone) => {
        setResponseFile('L0DoNotCreateAppPackage.json');
        var tr = new trm.TaskRunner('XamarinAndroid', true);
        tr.setInput('project', '**/test*.csproj');
		tr.setInput('target', '');
		tr.setInput('clean', 'false');
		tr.setInput('createAppPackage', 'false');
		tr.setInput('outputDir', '');
		tr.setInput('configuration', '');
		tr.setInput('msbuildLocation', '');
		tr.setInput('msbuildArguments', '');
		tr.setInput('javaHomeSelection', 'JDKVersion');
		tr.setInput('jdkVersion', 'default');
		
		tr.run()
		.then(() => {
			assert(tr.ran('/home/bin/xbuild /user/build/fun/test.csproj'), 'it should have run xamarin android build for test project');
			assert(tr.invokedToolCount == 1, 'should have only run XamarinAndroid 1 time');
			assert(tr.resultWasSet, 'task should have set a result');
			assert(tr.stderr.length == 0, 'should not have written to stderr');
			assert(tr.succeeded, 'task should have succeeded');
				
			done();
		})
		.fail((err) => {
			done(err);
		});
        
    });

});