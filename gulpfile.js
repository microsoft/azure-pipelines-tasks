var gulp = require('gulp');
var path = require('path');
var del = require('del'); 
var shell = require('shelljs')
var pkgm = require('./package');
var gutil = require('gulp-util');
var zip = require('gulp-zip');
var minimist = require('minimist');
var os = require('os');
var fs = require('fs');
var semver = require('semver');
var Q = require('q');
var exec = require('child_process').exec;
var tsc = require('gulp-tsc');
var mocha = require('gulp-mocha');
var cp = require('child_process');

var NPM_MIN_VER = '3.0.0';
var MIN_NODE_VER = '4.0.0';

if (semver.lt(process.versions.node, MIN_NODE_VER)) {
    console.error('requires node >= ' + MIN_NODE_VER + '.  installed: ' + process.versions.node);
    process.exit(1);
}

/*
Distinct build, test and Packaging Phases:

Build:
- validate the task.json for each task
- generate task.loc.json file and strings file for each task.  allows for hand off to loc.
- compile .ts --> .js
- "link" in the vso-task-lib declared in package.json into tasks using node handler

Test:
- Run Tests (L0, L1) - see docs/runningtests.md
- copy the mock task-lib to the root of the temp test folder
- Each test:
   - copy task to a temp dir.
   - delete linked copy of task-lib (so it uses the mock one above)
   - run

Package (only on windows):
- zip the tasks.
- if nuget found (windows):
  - create nuget package
  - if server url, publish package - this is for our VSO build 
*/

var mopts = {
  boolean: 'ci',
  string: 'suite',
  default: { ci: false, suite: '**' }
};

var options = minimist(process.argv.slice(2), mopts);

var _buildRoot = path.join(__dirname, '_build', 'Tasks');
var _testRoot = path.join(__dirname, '_build', 'Tests');
var _testTemp = path.join(_testRoot, 'Temp');
var _pkgRoot = path.join(__dirname, '_package');
var _oldPkg = path.join(__dirname, 'Package');
var _wkRoot = path.join(__dirname, '_working');

var _tempPath = path.join(__dirname, '_temp');

gulp.task('clean', function (cb) {
	del([_buildRoot, _tempPath, _pkgRoot, _wkRoot, _oldPkg],cb);
});

gulp.task('cleanTests', function (cb) {
	del([_testRoot],cb);
});

gulp.task('compileTests', ['cleanTests'], function (cb) {
	var testsPath = path.join(__dirname, 'Tests', '**/*.ts');
	return gulp.src([testsPath, 'definitions/*.d.ts'])
		.pipe(tsc())
		.pipe(gulp.dest(_testRoot));
});

gulp.task('ps1tests', ['compileTests'], function (cb) {
	return gulp.src(['Tests/**/*.ps1', 'Tests/**/*.json'])
		.pipe(gulp.dest(_testRoot));
});

gulp.task('testLib', ['compileTests'], function (cb) {
	return gulp.src(['Tests/lib/**/*'])
		.pipe(gulp.dest(path.join(_testRoot, 'lib')));
});

gulp.task('testResources', ['testLib', 'ps1tests']);

// compile tasks inline
gulp.task('compileTasks', ['clean'], function (cb) {
	try {
		getLatestTaskLib();
	}
	catch (err) {
		console.log('error:' + err.message);
		cb(new gutil.PluginError('compileTasks', err.message));
		return;
	}	
	

	var tasksPath = path.join(__dirname, 'Tasks', '**/*.ts');
	return gulp.src([tasksPath, 'definitions/*.d.ts'])
	.pipe(tsc())
	.pipe(gulp.dest(path.join(__dirname, 'Tasks')));
});

gulp.task('compile', ['compileTasks', 'compileTests']);

gulp.task('build', ['compileTasks'], function () {
	shell.mkdir('-p', _buildRoot);
	return gulp.src(path.join(__dirname, 'Tasks', '**/task.json'))
        .pipe(pkgm.PackageTask(_buildRoot));
});

gulp.task('test', ['testResources'], function () {
	process.env['TASK_TEST_TEMP'] = _testTemp;
	shell.rm('-rf', _testTemp);
	shell.mkdir('-p', _testTemp);

	var suitePath = path.join(_testRoot, options.suite + '/_suite.js');

	return gulp.src([suitePath])
		.pipe(mocha({ reporter: 'spec', ui: 'bdd', useColors: !options.ci }));
});

gulp.task('default', ['build']);

//-----------------------------------------------------------------------------------------------------------------
// INTERNAL BELOW
//
// This particular task is for internal microsoft publishing as a nuget package for the VSO build to pick-up
// Contributors should not need to run this task
// This task requires windows and direct access to the internal nuget drop
//-----------------------------------------------------------------------------------------------------------------

var getLatestTaskLib = function() {
	gutil.log('Getting latest vso-task-lib');
	shell.mkdir('-p', path.join(_tempPath, 'node_modules'));
	
	var pkg = {
		  "name": "temp",
		  "version": "1.0.0",
		  "description": "temp to avoid warnings",
		  "main": "index.js",
		  "dependencies": {},
		  "devDependencies": {},
		  "repository": "http://norepo/but/nowarning",
		  "scripts": {
		    "test": "echo \"Error: no test specified\" && exit 1"
		  },
		  "author": "",
		  "license": "MIT"
		};
	fs.writeFileSync(path.join(_tempPath, 'package.json'), JSON.stringify(pkg, null, 2));

	shell.pushd(_tempPath);

	var npmPath = shell.which('npm');
	if (!npmPath) {
		throw new Error('npm not found.  ensure npm 3 or greater is installed');
	}

	var s = cp.execSync('"' + npmPath + '" --version');
	var ver = s.toString().replace(/[\n\r]+/g, '')
	console.log('version: "' + ver + '"');

	if (semver.lt(ver, NPM_MIN_VER)) {
		throw new Error('NPM version must be at least ' + NPM_MIN_VER + '. Found ' + ver);
	}

	var cmdline = '"' + npmPath + '" install vso-task-lib';

	var res = cp.execSync(cmdline); 
	gutil.log(res.toString());	
	shell.popd();
	if (res.status > 0) {
		throw new Error('npm failed with code of ' + res.status);
	}	
}

var QExec = function(commandLine) {
	var defer = Q.defer();

	gutil.log('running: ' + commandLine)
	var child = exec(commandLine, function(err, stdout, stderr) {
		if (err) {
			defer.reject(err);
			return;
		}

		if (stdout) {
			gutil.log(stdout);
		}

		if (stderr) {
			gutil.log(stderr);	
		}

		defer.resolve();
	});

	return defer.promise;
}

gulp.task('zip', ['build'], function(done) {
	shell.mkdir('-p', _wkRoot);
	var zipPath = path.join(_wkRoot, 'contents');

	return gulp.src(path.join(_buildRoot, '**', '*'))
	           .pipe(zip('Microsoft.TeamFoundation.Build.Tasks.zip'))	        
	           .pipe(gulp.dest(zipPath));
});

//
// gulp package --version 1.0.31 [--server <nugetServerLocation>]
//
gulp.task('package', ['zip'], function(done) {
	var nugetPath = shell.which('nuget');
	if (!nugetPath) {
		done(new gutil.PluginError('PackageTask', 'nuget.exe needs to be in the path.  could not find.'));
		return;
	}

	var nuget3Path = shell.which('nuget3');
	if (!nuget3Path) {
		done(new gutil.PluginError('PackageTask', 'nuget3.exe needs to be in the path.  could not find.'));
		return;
	}

	var options = minimist(process.argv.slice(2), {});
	var version = options.version;
	if (!version) {
		done(new gutil.PluginError('PackageTask', 'supply version with --version'));
		return;		
	}

	if (!semver.valid(version)) {
		done(new gutil.PluginError('PackageTask', 'invalid semver version: ' + version));
		return;				
	}	

	var server = options.server;

	shell.mkdir('-p', _pkgRoot);
	
	var pkgName = 'Mseng.MS.TF.Build.Tasks';

	gutil.log('Generating .nuspec file');
	var contents = '<?xml version="1.0" encoding="utf-8"?>' + os.EOL;
		contents += '<package xmlns="http://schemas.microsoft.com/packaging/2010/07/nuspec.xsd">' + os.EOL;
        contents += '   <metadata>' + os.EOL;
        contents += '      <id>' + pkgName + '</id>' + os.EOL;
        contents += '      <version>' + version + '</version>' + os.EOL;
        contents += '      <authors>bigbldt</authors>' + os.EOL;
        contents += '      <owners>bigbldt,Microsoft</owners>' + os.EOL;
        contents += '      <requireLicenseAcceptance>false</requireLicenseAcceptance>' + os.EOL;
        contents += '      <description>For VSS internal use only</description>' + os.EOL;
        contents += '      <tags>VSSInternal</tags>' + os.EOL;
    	contents += '   </metadata>' + os.EOL;
		contents += '</package>' + os.EOL;

	var nuspecPath = path.join(_wkRoot, pkgName + '.nuspec');
	fs.writeFile(nuspecPath, contents, function(err) {
		if (err) {
			done(new gutil.PluginError('PackageTask', err.message));
			return;
		}

		var cmdline = '"' + nugetPath + '" pack ' + nuspecPath + ' -OutputDirectory ' + _pkgRoot;
		QExec(cmdline)
		.then(function() {
			// publish only if version and source supplied - used by CI server that does official publish
			if (server) {

				var nuget3Path = shell.which('nuget3');
				if (!nuget3Path) {
					done(new gutil.PluginError('PackageTask', 'nuget3.exe needs to be in the path.  could not find.'));
					return;
				}
								
				var pkgLocation = path.join(_pkgRoot, pkgName + '.' + version + '.nupkg');
				var cmdline = '"' + nuget3Path + '" push ' + pkgLocation + ' -Source ' + server + ' -apikey Skyrise';
				return QExec(cmdline);				
			}
			else {
				return;
			}

		})
		.then(function() {
			done();
		})
		.fail(function(err) {
			done(new gutil.PluginError('PackageTask', err.message));
		})
		
	});
});
