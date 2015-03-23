var through = require('through2');
var gutil = require('gulp-util');
var path = require('path');
var fs = require('fs');
var check = require('validator');
var shell = require('shelljs');

var createError = function(msg) {
	return new gutil.PluginError('PackageTask', msg);
}

var validate = function(folderName, task, done) {
	var vn = (task.name  || folderName);

	if (!task.id || !check.isUUID(task.id)) {
		done(createError(vn + ': id is a required guid'));
		return;
	};

	if (!task.name || !check.isAlphanumeric(task.name)) {
		done(createError(vn + ': name is a required alphanumeric string'));
		return;
	}

	if (!task.friendlyName || !check.isLength(task.friendlyName, 1, 40)) {
		done(createError(vn + ': friendlyName is a required string <= 40 chars'));
		return;
	}

	done();
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

	        validate(folderName, task, function(err) {
	        	if (err) {
	        		done(err);
	        		return;
	        	}

				gutil.log('Packaging: ' + task.name);
	        	var verStr = task.version.Major + '.' + task.version.Minor + '.' + task.version.Patch;
	        	var verPath = path.join(pkgPath, task.name, verStr);
	        	shell.mkdir('-p', verPath);
	        	shell.cp('-R', path.join(dirName, '*'), verPath);
	        	shell.rm(path.join(verPath, '*.csproj'));
	        	done();
	        })
		});    
}
exports.PackageTask = packageTask;