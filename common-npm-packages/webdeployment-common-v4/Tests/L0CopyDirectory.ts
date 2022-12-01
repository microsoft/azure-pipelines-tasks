var mockery = require('mockery');
mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

var fileList = ["C:/vinca/path", "C:/vinca/path/myfile.txt",
                "C:/vinca/path/New Folder", "C:/vinca/path/New Folder/Another New Folder",
                "C:/vinca/New Folder/anotherfile.py", "C:/vinca/New Folder/Another New Folder/mynewfile.txt"];

var mkdirPCount = 0;
var cpfilesCount = 0;
mockery.registerMock('azure-pipelines-task-lib/task', {
    exist: function (path) {
        console.log("exist : " + path);
    },
    find: function (path) {
        console.log("find : " + path);
        return fileList;
    },
    mkdirP: function (path) {
        mkdirPCount += 1;
        console.log("mkdirp : " + path);
    },
    cp: function (source, dest, options, continueOnError) {
        if(fileList.indexOf(source)!= -1) {
            cpfilesCount += 1;
            console.log('cp ' + source + ' to ' + dest);
        }
    },
    stats: function (path) {
        return {
            isDirectory: function() {
                if(path.endsWith('.py') || path.endsWith('.txt')) {
                    return false;
                }
                return true;
            }
        };
    },
    debug: function(message) {
        console.log(message);
    }
});
var utility = require('azure-pipelines-tasks-webdeployment-common-v4/utility.js');
utility.copyDirectory('C:/vinca/path', 'C:/vinca/path/destFolder');

if(cpfilesCount === 3) {
    console.log('## Copy Files Successful ##');
}
/**
 * 7 dir to be created including dest dir
 * Hash is not created to check already created dir, for testing purpose
 */
if(mkdirPCount === 7) {
    console.log('## mkdir Successful ##');    
}

