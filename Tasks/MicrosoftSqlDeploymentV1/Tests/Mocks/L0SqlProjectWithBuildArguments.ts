import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', '..', 'src', 'microsoftsqldeployment.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs with build arguments
tmr.setInput('action', 'publish');
tmr.setInput('path', '/fake/project/MyDatabase.sqlproj');
tmr.setInput('connectionString', 'Server=myserver.database.windows.net;Database=MyDB;User Id=admin;Password=pass123');
tmr.setInput('buildArguments', '-c Release /p:TreatWarningsAsErrors=true');

// Mock answers
let a: ma.TaskLibAnswers = {
    'which': {
        'dotnet': '/usr/bin/dotnet'
    },
    'checkPath': {
        '/fake/project/MyDatabase.sqlproj': true,
        '/usr/bin/dotnet': true
    },
    'exist': {
        '/fake/project/MyDatabase.sqlproj': true,
        '/fake/project/bin/Release/MyDatabase.dacpac': true
    },
    'exec': {
        'dotnet build /fake/project/MyDatabase.sqlproj -p:NetCoreBuild=true -c Release /p:TreatWarningsAsErrors=true': {
            'code': 0,
            'stdout': 'Build succeeded.'
        }
    }
};
tmr.setAnswers(a);

// Mock modules
tmr.registerMock('./SqlPackageHelper', {
    findSqlPackage: function() {
        return '/usr/local/bin/sqlpackage';
    }
});

tmr.registerMock('./SqlcmdHelper', {
    findSqlcmd: function() {
        return '/usr/local/bin/sqlcmd';
    }
});

tmr.run();
