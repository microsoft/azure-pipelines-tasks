var through = require('through2');
var gutil = require('gulp-util');
var path = require('path');
var fs = require('fs');
var check = require('validator');
var shell = require('shelljs');
var Q = require('q');
var os = require('os');
var cp = require('child_process');
var gulp = require('gulp');
var request = require('request');
var unzip = require('gulp-unzip');
var stream = require('stream');

var _strRelPath = path.join('Strings', 'resources.resjson', 'en-US');

var _tempPath = path.join(__dirname, '_temp');

var createError = function (msg) {
	return new gutil.PluginError('PackageTask', msg);
}

var validateModule = function (folderName, module) {
    var defer = Q.defer();
    defer.resolve();
    return defer.promise;
}

// Validates the structure of a task.json file.
var validateTask = function (folderName, task) {
	var defer = Q.defer();

	var vn = (task.name || folderName);

	if (!task.id || !check.isUUID(task.id)) {
		defer.reject(createError(vn + ': id is a required guid'));
	};

	if (!task.name || !check.isAlphanumeric(task.name)) {
		defer.reject(createError(vn + ': name is a required alphanumeric string'));
	}

	if (!task.friendlyName || !check.isLength(task.friendlyName, 1, 40)) {
		defer.reject(createError(vn + ': friendlyName is a required string <= 40 chars'));
	}

	if (!task.instanceNameFormat) {
		defer.reject(createError(vn + ': instanceNameFormat is required'));
	}

	// resolve if not already rejected
	defer.resolve();
	return defer.promise;
};

var LOC_FRIENDLYNAME = 'loc.friendlyName';
var LOC_HELPMARKDOWN = 'loc.helpMarkDown';
var LOC_DESCRIPTION = 'loc.description';
var LOC_INSTFORMAT = 'loc.instanceNameFormat';
var LOC_GROUPDISPLAYNAME = 'loc.group.displayName.';
var LOC_INPUTLABEL = 'loc.input.label.';
var LOC_INPUTHELP = 'loc.input.help.';
var LOC_MESSAGES = 'loc.messages.';

var createStrings = function (task, pkgPath, srcPath) {
	var defer = Q.defer();

	var strPath = path.join(pkgPath, _strRelPath);
	shell.mkdir('-p', strPath);
	var srcStrPath = path.join(srcPath, _strRelPath);
	shell.mkdir('-p', srcStrPath);

	//
	// Loc tasks.json and product strings content
	//
	var strings = {};
	strings[LOC_FRIENDLYNAME] = task.friendlyName;
	task['friendlyName'] = 'ms-resource:' + LOC_FRIENDLYNAME;

	strings[LOC_HELPMARKDOWN] = task.helpMarkDown;
	task['helpMarkDown'] = 'ms-resource:' + LOC_HELPMARKDOWN;

	strings[LOC_DESCRIPTION] = task.description;
	task['description'] = 'ms-resource:' + LOC_DESCRIPTION;

	strings[LOC_INSTFORMAT] = task.instanceNameFormat;
	task['instanceNameFormat'] = 'ms-resource:' + LOC_INSTFORMAT;

	if (task.groups) {
		task.groups.forEach(function (group) {
			if (group.name) {
				var key = LOC_GROUPDISPLAYNAME + group.name;
				strings[key] = group.displayName;
				group.displayName = 'ms-resource:' + key;
			}
		});
	}

	if (task.inputs) {
		task.inputs.forEach(function (input) {
			if (input.name) {
				var labelKey = LOC_INPUTLABEL + input.name;
				strings[labelKey] = input.label;
				input.label = 'ms-resource:' + labelKey;

				if (input.helpMarkDown) {
					var helpKey = LOC_INPUTHELP + input.name;
					strings[helpKey] = input.helpMarkDown;
					input.helpMarkDown = 'ms-resource:' + helpKey;
				}
			}
		});
	}

	if (task.messages) {
		for (var key in task.messages) {
			var messageKey = LOC_MESSAGES + key;
			strings[messageKey] = task.messages[key];
			task.messages[key] = 'ms-resource:' + messageKey;
		}
	}

	//
	// Write the tasks.json and strings file in package and back to source
	//
	var enPath = path.join(strPath, 'resources.resjson');
	var enSrcPath = path.join(srcStrPath, 'resources.resjson');

	var enContents = JSON.stringify(strings, null, 2);
	fs.writeFile(enPath, enContents, function (err) {
		if (err) {
			defer.reject(createError('could not create: ' + enPath + ' - ' + err.message));
			return;
		}

		var taskPath = path.join(pkgPath, 'task.loc.json');

		var contents = JSON.stringify(task, null, 2);

		fs.writeFile(taskPath, contents, function (err) {
			if (err) {
				defer.reject(createError('could not create: ' + taskPath + ' - ' + err.message));
				return;
			}

			// copy the loc assets back to the src so they can be checked in
			shell.cp('-f', enPath, enSrcPath);
			shell.cp('-f', taskPath, path.join(srcPath, 'task.loc.json'));

			defer.resolve();
		});

	})

	return defer.promise;
};

function locCommon() {
    return through.obj(
        function (moduleJson, encoding, done) {
            // Validate the module.json file exists.
            if (!fs.existsSync(moduleJson)) {
                new gutil.PluginError('PackageModule', 'Module json cannot be found: ' + moduleJson.path);
            }

            if (moduleJson.isNull() || moduleJson.isDirectory()) {
                this.push(moduleJson);
                return callback();
            }

            // Deserialize the module.json.
            var jsonContents = moduleJson.contents.toString();
            var module = {};
            try {
                module = JSON.parse(jsonContents);
            }
            catch (err) {
                done(createError('Common module ' + moduleJson.path + ' parse error: ' + err.message));
                return;
            }

            // Build the content for the en-US resjson file.
            var strPath = path.join(path.dirname(moduleJson.path), _strRelPath);
            shell.mkdir('-p', strPath);
            var strings = {};
            if (module.messages) {
                for (var key in module.messages) {
                    var messageKey = LOC_MESSAGES + key;
                    strings[messageKey] = module.messages[key];
                }
            }

            // Create the en-US resjson file.
            var enPath = path.join(strPath, 'resources.resjson');
            var enContents = JSON.stringify(strings, null, 2);
            fs.writeFile(enPath, enContents, function (err) {
                if (err) {
                    done(createError('Could not create: ' + enPath + ' - ' + err.message));
                    return;
                }
            })

            done();
        });
}

function packageTask(pkgPath, commonDeps, commonSrc) {
    return through.obj(
		function (taskJson, encoding, done) {
			if (!fs.existsSync(taskJson)) {
				new gutil.PluginError('PackageTask', 'Task json cannot be found: ' + taskJson.path);
			}

			if (taskJson.isNull() || taskJson.isDirectory()) {
				this.push(taskJson);
				return callback();
			}

			var dirName = path.dirname(taskJson.path);
			var folderName = path.basename(dirName);
			var jsonContents = taskJson.contents.toString();
			var task = {};

			try {
				task = JSON.parse(jsonContents);
			}
			catch (err) {
				done(createError(folderName + ' parse error: ' + err.message));
				return;
			}

			var tgtPath;
			var promises = [];
			var deferred = Q.defer();
			promises.push(deferred.promise);

			promises.push(validateTask(folderName, task)
				.then(function () {
					// Copy the task to the layout folder.
					gutil.log('Packaging: ' + task.name);
					tgtPath = path.join(pkgPath, task.name);
					shell.mkdir('-p', tgtPath);
					shell.cp('-R', path.join(dirName, '*'), tgtPath);
					shell.rm(path.join(tgtPath, '*.csproj'));
					shell.rm(path.join(tgtPath, '*.md'));

					// Statically link the Node externals.
					var externals = require('./externals.json');
					if (task.execution['Node']) {
						// Determine the vsts-task-lib version.
						var libVer = externals.npm['vsts-task-lib'];
						if (!libVer) {
							throw new Error('External vsts-task-lib not defined in externals.json.');
						}

						// Copy the lib from the cache.
						gutil.log('Linking vsts-task-lib ' + libVer);
						var copySource = path.join(_tempPath, 'npm', 'vsts-task-lib', libVer, 'node_modules', '*');
						var copyTarget = path.join(tgtPath, 'node_modules');
						shell.mkdir('-p', copyTarget);
						shell.cp('-R', copySource, copyTarget);
					}

					// Statically link the PowerShell3 externals.
					if (task.execution['PowerShell3']) {
						// Determine the URL.
						var libInfo = externals.nugetv2.VstsTaskSdk;
						var url = libInfo.repository.replace(/\/$/, '') + '/package/VstsTaskSdk/' + libInfo.version;

						// Copy the nuget v2 package from the cache.
						//
						// PowerShell is not used to download the VstsTaskSdk from the gallery to
						// avoid a PowerShell 5 dev dependency for building the tasks in this repo.
						gutil.log('Linking VstsTaskSdk ' + libInfo.version);
						var scrubbedUrl = url.replace(/[/\:?]/g, '_');
						var copySource = path.join(_tempPath, "archive", scrubbedUrl, '*');
						var copyTarget = path.join(tgtPath, 'ps_modules', 'VstsTaskSdk');
						shell.mkdir('-p', copyTarget);
						shell.cp('-R', copySource, copyTarget);
						shell.rm('-rf', path.join(copyTarget, 'package'));
						shell.rm('-rf', path.join(copyTarget, '_rels'));
						shell.rm(path.join(copyTarget, 'VstsTaskSdk.nuspec'));
						shell.rm(path.join(copyTarget, '[Content_Types].xml'));
					}

					// Statically link the internal common modules.
					//
					// Note, this must come before the task-specific externals are statically linked.
					// Internal common modules can contain external references.
					var taskDeps = commonDeps[task.name];
					if (taskDeps) {
						taskDeps.forEach(function (dep) {
							gutil.log('Linking ' + dep.module + ' into ' + task.name);
							var src = path.join(commonSrc, dep.module);
							var dest = path.join(tgtPath, dep.dest);
							shell.mkdir('-p', dest);
							shell.cp('-R', src, dest);
						})
					}

					// Statically link the task-specific externals.
					shell.find(tgtPath)
						.filter(function (file) {
							return file.match(/(\/|\\)externals\.json$/);
						})
						.forEach(function (nestedExternalsJson) {
							// Load the externals.json.
							var nestedExternals = require(nestedExternalsJson);

							// Walk the array of archive file references (e.g. zip files).
							if (nestedExternals.archivePackages) {
								nestedExternals.archivePackages.forEach(function (archive) {
									// Copy the archive directory.
									gutil.log('Linking files from ' + archive.archiveName);
									var scrubbedUrl = archive.url.replace(/[/\:?]/g, '_');
									var archiveSource = path.join(_tempPath, "archive", scrubbedUrl, '*');
									var archiveTarget = path.join(path.dirname(nestedExternalsJson), archive.dest);
									shell.mkdir('-p', archiveTarget);
									shell.cp('-R', archiveSource, archiveTarget);
								});
							}
						});

					// TODO: Remove support for task-specific package.json files and switch to
					// externals.json for task-specific npm packages (handles caching).

					// Run npm install if packages.json exists.
					var pkgJsonPath = path.join(tgtPath, 'package.json');
					if (fs.existsSync(pkgJsonPath)) {

						// Ensure a node_modules directory. Otherwise the modules can be installed
						// in a node_modules directory further up the directory hierarchy.
						shell.mkdir('-p', path.join(tgtPath, 'node_modules'));

						// Run npm install
						gutil.log('package.json exists.  Running npm install');
						shell.pushd(tgtPath);
						try {
							cp.execSync('npm install');
						}
						catch (err) {
							new gutil.PluginError('PackageTask', 'npm install failed');
							gutil.log(err.Message);
							throw new Error('npm install failed');
						}
						finally {
							shell.popd();
						}
					}

					deferred.resolve();
				}));

			Q.all(promises).then(function () {
				return createStrings(task, tgtPath, dirName);
			}).then(function () {
				done();
			}).fail(function (err) {
				done(err);
			});
		});
}

exports.LocCommon = locCommon;
exports.PackageTask = packageTask;
