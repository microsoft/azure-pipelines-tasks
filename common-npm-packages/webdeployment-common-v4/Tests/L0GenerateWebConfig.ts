var mockery = require('mockery');
mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('azure-pipelines-task-lib/task', {
    writeFile: function (file, data, options) {
        console.log("web.config contents: " + data);
    },
    debug: function(message: string) {
        console.log("##[debug]: " + message);
    }
});

mockery.registerMock('fs', {
    readFileSync: function (path, format) {
        return "{NodeStartFile};{Handler}"
    }
});

var generateWebConfig = require('azure-pipelines-tasks-webdeployment-common-v4/webconfigutil.js');
generateWebConfig.generateWebConfigFile(
    'node',
    'TemplatePath/node',
    {
        "Handler": "iisnode",
        "NodeStartFile":  "server.js"
    }
);

