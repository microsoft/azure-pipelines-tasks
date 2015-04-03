var through = require('through2');
var gutil = require('gulp-util');
var path = require('path');
var fs = require('fs');
var check = require('validator');
var shell = require('shelljs');
var Q = require('q');

var createError = function(msg) {
	return new gutil.PluginError('PackageTask', msg);
}

var validate = function(folderName, task) {
	var defer = Q.defer();

	var vn = (task.name  || folderName);

	if (!task.id || !check.isUUID(task.id)) {
		defer.reject(createError(vn + ': id is a required guid'));
	};

	if (!task.name || !check.isAlphanumeric(task.name)) {
		defer.reject(createError(vn + ': name is a required alphanumeric string'));
	}

	if (!task.friendlyName || !check.isLength(task.friendlyName, 1, 40)) {
		defer.reject(createError(vn + ': friendlyName is a required string <= 40 chars'));
	}

	// resolve if not already rejected
	defer.resolve();
	return defer.promise;
};

var createStrings = function(task, pkgPath) {
	var defer = Q.defer();

	var strPath = path.join(pkgPath, 'Strings', 'resources.resjson', 'en-US');
	shell.mkdir('-p', strPath);

	var strings = {};
	strings['loc.friendlyName'] = task.friendlyName;
	task['friendlyName'] = 'ms-resource:loc.friendlyName';

	var enPath = path.join(strPath, 'resources.resjson');
	fs.writeFile(enPath, JSON.stringify(strings, null, 2), function(err) {
		if (err) {
			defer.reject(createError('could not create: ' + enPath + ' - ' + err.message));
			return;
		}

		var taskPath = path.join(pkgPath, 'task.loc.json');
		fs.writeFile(taskPath, JSON.stringify(task, null, 2), function(err) {
			if (err) {
				defer.reject(createError('could not create: ' + taskPath + ' - ' + err.message));
				return;
			}

			defer.resolve();			
		});

	})

	return defer.promise;
};

function packageTask(pkgPath){
    return through.obj(
		function(taskJson, encoding, done) {
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
	        //throw new gutil.PluginError('PackageTask', folderName + ' test');
	        try {
	        	task = JSON.parse(jsonContents);
	        }
	        catch (err) {
	        	done(createError(folderName + ' parse error: ' + err.message));
	        	return
	        }

	        var tgtPath;

	        validate(folderName, task)
	        .then(function() {
				gutil.log('Packaging: ' + task.name);
	        	
	        	tgtPath = path.join(pkgPath, task.name);
	        	shell.mkdir('-p', tgtPath);
	        	shell.cp('-R', path.join(dirName, '*'), tgtPath);
	        	shell.rm(path.join(tgtPath, '*.csproj'));
	        	return;        	
	        })
	        .then(function() {
	        	return createStrings(task, tgtPath);
	        })
	        .then(function() {
	        	done();
	        })
	        .fail(function(err) {
	        	done(err);
	        })
		});    
}
exports.PackageTask = packageTask;