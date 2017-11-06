var mockery = require('mockery');
var jsonSubUtil = require('webdeployment-common/jsonvariablesubstitutionutility.js');
var path = require('path');
var folderPath = path.join(__dirname, 'L1JSONVarSub', 'tempFolder');
var taskLib = require('vsts-task-lib/task');
mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});


mockery.registerMock('vsts-task-lib/task', {
    getVariables: function() {
        return [
            {name: 'data.connection.mysql', value: 'new_mysql_connection', secret: false},
            {name: 'blob.blob1.container', value: 'azcopy_blob_url', secret: false},
            {name: 'diagnostics.full_log', value: 'disabled', secret: false},
            {name: 'data.connection.mongodbsql', value: 'mongodbsql_new_connection', secret: false}
        ]
    },
    writeFile: taskLib.writeFile,
    debug: taskLib.debug

});

jsonSubUtil.jsonVariableSubstitution(folderPath, ['**/*.json']);
