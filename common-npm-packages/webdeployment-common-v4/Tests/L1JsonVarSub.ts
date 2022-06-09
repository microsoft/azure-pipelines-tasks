import { validate } from './L1JSONVarSubWithComments';
var jsonSubUtil = require('azure-pipelines-tasks-webdeployment-common-v4/jsonvariablesubstitutionutility.js');

var envVarObject = jsonSubUtil.createEnvTree([
    { name: 'system.debug', value: 'true', secret: false},
    { name: 'data.ConnectionString', value: 'database_connection', secret: false},
    { name: 'data.userName', value: 'db_admin', secret: false},
    { name: 'data.password', value: 'db_pass', secret: true},
    { name: '&pl.ch@r@cter.k^y', value: '*.config', secret: false},
    { name: 'build.sourceDirectory', value: 'DefaultWorkingDirectory', secret: false},
    { name: 'user.profile.name.first', value: 'firstName', secret: false},
    { name: 'user.profile', value: 'replace_all', secret: false},
    { name: 'constructor.name', value: 'newConstructorName', secret: false},
    { name: 'constructor.valueOf', value: 'constructorNewValue', secret: false},
    { name: 'systemsettings.appurl', value: 'https://dev.azure.com/helloworld', secret: false}
]);

var jsonObject = {
    'User.Profile': 'do_not_replace',
    'data': {
        'ConnectionString' : 'connect_string',
        'userName': 'name',
        'password': 'pass'
    },
    '&pl': {
        'ch@r@cter.k^y': 'v@lue'
    },
    'system': {
        'debug' : 'no_change'
    },
    'user.profile': {
        'name.first' : 'fname'
    },
    'constructor.name': 'myconstructorname',
    'constructor': {
        'name': 'myconstructorname',
        'valueOf': 'myconstructorvalue'
    },
    'systemsettings': {
        'appurl': 'https://helloworld.visualstudio.com'
    }
}
// Method to be checked for JSON variable substitution
jsonSubUtil.substituteJsonVariable(jsonObject, envVarObject);

if(typeof jsonObject['user.profile'] === 'object') {
    console.log('JSON - eliminating object variables validated');
}
if(jsonObject['data']['ConnectionString'] === 'database_connection'
    && jsonObject['data']['userName'] === 'db_admin'
    && jsonObject['systemsettings']['appurl'] == 'https://dev.azure.com/helloworld') {
    console.log('JSON - simple string change validated');
}
if(jsonObject['system']['debug'] === 'no_change') {
    console.log('JSON - system variable elimination validated');
}
if(jsonObject['&pl']['ch@r@cter.k^y'] === '*.config') {
    console.log('JSON - special variables validated');
}
if(jsonObject['user.profile']['name.first'] === 'firstName') {
    console.log('JSON - variables with dot character validated');
}
if(jsonObject['User.Profile'] === 'do_not_replace') {
    console.log('JSON - case sensitive variables validated');
}
if(jsonObject['constructor.name'] === 'newConstructorName' && 
    jsonObject['constructor']['name'] === 'newConstructorName' && jsonObject['constructor']['valueOf'] === 'constructorNewValue') {
        console.log('JSON - substitute inbuilt JSON attributes validated');
}

validate();
