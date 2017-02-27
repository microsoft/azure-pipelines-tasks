var mockery = require('mockery');
mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('vso-node-api/HttpClient', {
    HttpCallbackClient: function () {
        return {
            send: function (verb, url) {
                if(verb == 'PUT' && url == 'https://mytestappKuduUrl/api/vfs//site/wwwroot/kuduPostDeploymentScript.cmd') {
                    console.log('PUT:https://mytestappKuduUrl/api/vfs//site/wwwroot/kuduPostDeploymentScript.cmd');
                    return;
                }
                if(verb == 'POST' && url == 'https://mytestappKuduUrl/api/command') {
                    console.log('POST:https://mytestappKuduUrl/api/command');
                    return;
                }
                throw Error('Unknown verb or URL - SEND');
            },
            get: function(verb, url) {
                if(verb == 'DELETE' && url == 'https://mytestappKuduUrl/api/vfs//site/wwwroot/kuduPostDeploymentScript.cmd') {
                    console.log("DELETED:https://mytestappKuduUrl/api/vfs//site/wwwroot/kuduPostDeploymentScript.cmd");
                    return;
                }
                throw Error('Unknown verb or URL - GET');
            }
        };
    }
});

mockery.registerMock('q', {
    'defer': function() {
        return {
            promise: 'promise'
        }
    }
});
var kuduUtility = require('webdeployment-common/kuduutility.js');

var mockPublishProfile = {
    profileName: 'mytestapp - Web Deploy',
    publishMethod: 'MSDeploy',
    publishUrl: 'mytestappKuduUrl',
    msdeploySite: 'mytestapp',
    userName: '$mytestapp',
    userPWD: 'mytestappPwd',
    destinationAppUrl: 'mytestappUrl',
    SQLServerDBConnectionString: '',
    mySQLDBConnectionString: '',
    hostingProviderForumLink: '',
    controlPanelLink: '',
    webSystem: 'WebSites' 
};

kuduUtility.runPostDeploymentScript(mockPublishProfile, "Inline Script", "echo 'hello'", null, false);