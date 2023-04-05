var mockery = require('mockery');
var path = require('path');
mockery.enable({
    useCleanCache: true,
    warnOnReplace: false,
    warnOnUnregistered: false
});

mockery.registerMock('typed-rest-client/HttpClient', {
    HttpClient: function() {
        return {
            get: function(url, headers) {
                url = url.substring(0, url.lastIndexOf('_')) + path.extname(url);
                var getUrlMap = {
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/stdout.txt': 'stdout content',
                   'https://mytestappKuduUrl/api/vfs/site/wwwroot/stderr.txt': 'sterr content',
                   'https://mytestappKuduUrl/api/vfs/site/wwwroot/script_result.txt': '0'
               };

               if(getUrlMap[url]) {
                  console.log('GET:' + url);
                  return {
                    then: function(handler) {
                        handler({
                            message: {
                                statusCode: 200,
                                statusMessage: "Success"
                            },
                            readBody: function() {
                                return getUrlMap[url];
                            }
                        });
                    }  
                  }; 
               }
               throw Error('Unknown verb or URL - GET');
            },
            del: function(url, headers) {
                url = url.substring(0, url.lastIndexOf('_')) + path.extname(url);

                var deleteUrlArray = [
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/kuduPostDeploymentScript.cmd',
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/mainCmdFile.cmd'
                ];

                if (deleteUrlArray.indexOf(url) != -1) {
                    console.log("DELETED:" + url);
                    return;
                }

                throw Error('Unknown verb or URL - GET');
            },
            post: function(url, data, headers) {
                if (url == 'https://mytestappKuduUrl/api/command') {
                    console.log('POST:https://mytestappKuduUrl/api/command');
                    return;
                }
                throw Error('Unknown verb or URL - SEND');
            },
            sendStream: function(verb, url) {
                url = url.substring(0, url.lastIndexOf('_')) + path.extname(url);
                var urlArray = [
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/kuduPostDeploymentScript.cmd',
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/mainCmdFile.cmd',
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/delete_log_file.cmd'
                ];

                if(verb == 'PUT' && urlArray.indexOf(url) != -1) {
                    console.log('PUT:' + url);
                    return;
                }
                throw Error('Unknown verb or URL - sendStream');
            }
        }
    }
});

mockery.registerMock('typed-rest-client/RestClient', {
    RestClient: function() {
        return {
            get: function(url, options) {
                url = url.substring(0, url.lastIndexOf('_')) + path.extname(url);
                var getUrlMap = {
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/stdout.txt': 'stdout content',
                   'https://mytestappKuduUrl/api/vfs/site/wwwroot/stderr.txt': 'sterr content',
                   'https://mytestappKuduUrl/api/vfs/site/wwwroot/script_result.txt': '0'
               };

               if(getUrlMap[url]) {
                  console.log('GET:' + url);
                  return getUrlMap[url];
               }

               throw Error('Unknown verb or URL - GET');
            },
            del: function(url, options) {
                url = url.substring(0, url.lastIndexOf('_')) + path.extname(url);

                var deleteUrlArray = [
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/kuduPostDeploymentScript.cmd',
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/mainCmdFile.cmd'
                ];

                if (deleteUrlArray.indexOf(url) != -1) {
                    console.log("DELETED:" + url);
                    return {
                        then: function() {
                        }
                    };
                }

                throw Error('Unknown verb or URL - GET');
            },
            create: function(url, resources, options) {
                if (url == 'https://mytestappKuduUrl/api/command') {
                    console.log('POST:https://mytestappKuduUrl/api/command');
                    return {
                        then: function() {
                        }
                    };
                }
                throw Error('Unknown verb or URL - SEND');
            },
            uploadStream: function(verb, url) {
                url = url.substring(0, url.lastIndexOf('_')) + path.extname(url);
                var urlArray = [
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/kuduPostDeploymentScript.cmd',
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/mainCmdFile.cmd',
                    'https://mytestappKuduUrl/api/vfs/site/wwwroot/delete_log_file.cmd'
                ];

                if(verb == 'PUT' && urlArray.indexOf(url) != -1) {
                    console.log('PUT:' + url);
                    return {
                        then: function() {
                        }
                    };
                }
                throw Error('Unknown verb or URL - sendStream');
            }
        }
    }
});

mockery.registerMock('azure-pipelines-task-lib/task', {
    exist: function() {
        return true;
    },
    getVariable: function(variable) {
        if(variable == "agent.proxyurl") {
            return null;
        }
        return 'workingDirectory';
    },
    debug: function(message) {
        console.log('##debug : ' + message);
    },
    loc: function(message, argument) {
        console.log('##LOC: ' + message + ' : ' + argument);
    },
    writeFile: function(fileName, content) {
        console.log('##FileWrite: ' + fileName);
    },
    rmRF: function(fileName) {
        console.log('##rmRF: ' + fileName);
    }

});
mockery.registerMock('q', {
    'defer': function() {
        return {
            promise: {
                'content': '0'
            },
            resolve: function(result) {
                return result;
            }
        };
    }
});

var fs = require('fs');
mockery.registerMock('fs', {
    'createReadStream': function() {
        return '';
    },
    statSync: fs.statSync,
    writeFileSync: fs.writeFileSync,
    readFileSync: fs.readFileSync
});
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

var kuduUtility = require('../kuduutility.js');
kuduUtility.runPostDeploymentScript(mockPublishProfile, 'site/wwwroot', "File Path", null, 'myscript.cmd', false, false);
