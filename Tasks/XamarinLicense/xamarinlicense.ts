/*
 Copyright (c) Microsoft. All rights reserved.
 Licensed under the MIT license. See LICENSE file in the project root for full license information.
 */

/// <reference path="../../definitions/vsts-task-lib.d.ts" />
import fs = require('fs');
import path = require('path');
import os = require('os');
import https = require('https');
import http = require('http');
import tl = require('vsts-task-lib/task');

// Get inputs
var action = tl.getInput('action', true);
var email = tl.getInput('email', true);
var password = tl.getInput('password', true);
var activateAndroid = tl.getInput('activateAndroid', false);
var product = tl.getInput('product', false);
var timeout = tl.getInput('timeout', false);

// Output debug information for inputs
tl.debug('action: ' + action);
tl.debug('email: ' + email);
tl.debug('product: ' + product);
tl.debug('activateAndroid: ' + activateAndroid);
tl.debug('timeout: ' + timeout);

// Function for error handling
var onFailedExecution = function (err) {
    // Error executing
    tl.error(err);
    tl.exit(1);
}

//validate inputs
if (!product) {
    //older task.json
    if (activateAndroid == 'true') {
        product = 'MA';
    }
}

if (!product) {
    onFailedExecution('No product selected to activate.');
}

if (isNaN(Number(timeout))) {
    timeout = '30';
}
var timeoutInSecs = Number(timeout);

var getLicenseLocation = function (product) {
    var licenseLocation;
    if (product == 'MA' && os.platform() == 'darwin') {
        licenseLocation = process.env.HOME + '/Library/MonoAndroid/License.v2';
    } else if (product == 'MT' && os.platform() == 'darwin') {
        licenseLocation = process.env.HOME + '/Library/MonoTouch/License.v2';
    } else if (product == 'MM' && os.platform() == 'darwin') {
        licenseLocation = process.env.HOME + '/Library/Xamarin.Mac/License.v2'
    } else if (product == 'MA' && os.platform() == 'win32') {
        licenseLocation = process.env.PROGRAMDATA + '\\Mono For Android\\License\\monoandroid.licx';
    } else if (product == 'MT' && os.platform() == 'win32') {
        licenseLocation = process.env.PROGRAMDATA + '\\MonoTouch\\License\\monotouch.licx';
    }

    return licenseLocation;
}

if (!getLicenseLocation(product)) {
    onFailedExecution('The xamarin product: ' + product + ' is not supported on this os: ' + os.platform());
}

//xamarin data file
var getDataFileLocation = function (product) {
    var dataFileLocation = process.env.HOME + '/vsts_generated_' + product + '.dat';
    if (os.platform() == 'win32') {
        dataFileLocation = process.env.USERPROFILE + '\\vsts_generated_' + product + '.dat';
    }
    return dataFileLocation;
}

var doHttpRequest = function (options, requestBody, timeout, callback) {
    var reqData;
    var socket;

    if (requestBody) {
        reqData = requestBody;
        options.headers["Content-Length"] = Buffer.byteLength(reqData, 'utf8');
    }

    var req = https.request(options, function (res) {
        var output = '';

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function () {
            callback(null, res, output);
        });
    });

    req.on('socket', function (sock) {
        socket = sock;
    });

    req.setTimeout(timeout, function () {
        if (socket) {
            socket.end();
        }
    });

    req.on('error', function (err) {
        callback(err, null, null);
    });

    if (reqData) {
        req.write(reqData, 'utf8');
    }

    req.end();
}

var loginToXamarin = function (email, password, callback) {
    var apiKey = '96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e';
    //Login as user
    tl.debug('Login as ' + email);
    var loginRequestBody = 'email=' + encodeURI(email) + '&password=' + encodeURI(password);
    var options = {
        host: 'auth.xamarin.com',
        path: '/api/v1/auth',
        method: 'POST',
        headers: {
            'Host': 'auth.xamarin.com',
            'User-Agent': 'vso-agent-tasks-Xamarin-License',
            'Authorization': 'Basic ' + new Buffer(apiKey + ':').toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
    };
    doHttpRequest(options, loginRequestBody, timeoutInSecs, function (err, res, output) {
        if (err) {
            tl.debug('Login failed: ' + err);
            callback('Failed to login to Xamarin with specified email and password.', null, null);
        }

        if (!output) {
            tl.debug('Login failed. HTTP response code: ' + res.ResponseCode);
            callback('Failed to login to Xamarin with specified email and password.', null, null);
        }

        var responseJson = JSON.parse(output);
        if (!responseJson || !responseJson.token || !responseJson.user || !responseJson.user.Guid) {
            tl.debug('Login failed. Json response: ' + output);
            callback('Failed to login to Xamarin with specified email and password.', null, null);
        }

        //Login succeeded
        callback(null, responseJson.token, responseJson.user.Guid);
    });
}

var activateLicense = function (email, password, product, callback) {
    loginToXamarin(email, password, function (err, token, userGuid) {
        if (err) {
            callback(err);
        }
        if (!token || !userGuid) {
            callback('Failed to login to Xamarin with specified email and password.');
        }

        tl.debug('Activate Xamarin license');

        //Provision the machine
        var mToolPath;
        if (product == 'MA') {
            //find path to mandroid
            var programFiles = 'C:\\Program Files (x86)';
            if (os.platform() == 'win32' && os.arch() == 'x64') {
                programFiles = process.env['PROGRAMFILES(X86)'];
            } else if (os.platform() == 'win32' && os.arch() == 'ia32') {
                programFiles = process.env.PROGRAMFILES;
            }

            if (os.platform() == 'darwin') {
                mToolPath = '/Library/Frameworks/Xamarin.Android.framework/Commands/mandroid';
            } else if (os.platform() == 'win32') {
                mToolPath = programFiles + '\\MSBuild\\Xamarin\\Android\\mandroid.exe';
            }
            if (!fs.existsSync(mToolPath)) {
                tl.debug('The path to mandroid does not exist: ' + mToolPath);
                callback('Failed to activate Xamarin license.');
            }
        } else if (product == 'MT' || product == 'MM') {
            //find path to mtouch
            if (os.platform() == 'darwin') {
                mToolPath = '/Library/Frameworks/Xamarin.iOS.framework/Versions/Current/bin/mtouch';
            } else {
                mToolPath = programFiles + '\\MSBuild\\Xamarin\\iOS\\mtouch.exe';
            }
            if (!fs.existsSync(mToolPath)) {
                tl.debug('The path to mtouch does not exist: ' + mToolPath);
                callback('Failed to activate Xamarin license.');
            }
        }

        var dataFileLocation = getDataFileLocation(product);
        tl.cd(path.dirname(mToolPath));
        var mToolRunner = tl.createToolRunner(mToolPath);
        mToolRunner.arg('--datafile');
        var toolOutput = mToolRunner.execSync(null); //We need the stdout, so use the sync version
        if (!toolOutput || !toolOutput.stdout) {
            tl.debug('Failed to generate data file using: ' + mToolPath);
            callback('Failed to activate Xamarin license.');
        }
        fs.writeFile(dataFileLocation, toolOutput.stdout, function (err) {
            if (err) {
                tl.debug('Failed to write data file: ' + err);
                callback('Failed to activate Xamarin license.');
            }

            //Read the xamarin.dat file
            fs.readFile(dataFileLocation, function (err, data) {
                if (err) {
                    tl.debug('Failed to read datafile: ' + err);
                    callback('Failed to activate Xamarin license.');
                }

                //Call Xamarin activation endpoint
                var options = {
                    host: 'activation.xamarin.com',
                    path: '/api/studio.ashx?guid=' + decodeURI(userGuid) + '&token=' + encodeURI(token) + '&product=' + encodeURI(product),
                    method: 'POST',
                    headers: {
                        'Host': 'activation.xamarin.com',
                        'User-Agent': 'vso-agent-tasks-Xamarin-License',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                };

                doHttpRequest(options, data, timeoutInSecs, function (err, res, output) {
                    if (err) {
                        tl.debug('License activation failed: ' + err);
                        callback('Failed to activate Xamarin license.');
                    }
                    if (!output) {
                        tl.debug('License activation failed. Response code = ' + res.ResponseCode);
                        callback('Failed to activate Xamarin license.');
                    }

                    var jsonResponse = JSON.parse(output);
                    if (!jsonResponse || !jsonResponse.license) {
                        tl.debug('License activation failed. Response not as expected: ' + output);
                        callback('Failed to activate Xamarin license.');
                    }

                    //Activation succeeded
                    var licenseDecoded = new Buffer(jsonResponse.license, 'base64');

                    //Save license file
                    var licenseLocation = getLicenseLocation(product);
                    tl.mkdirP(path.dirname(licenseLocation));
                    fs.writeFile(licenseLocation, licenseDecoded, function (err) {
                        if (err) {
                            tl.debug('Failed to save license file: ' + err);
                            callback('Failed to save Xamarin license.');
                        }
                        callback(null);
                    }); //writeFile
                }); //doHttpRequest
            }); //read .dat file
        }); //toolrunner exec
    }); //login
}

var deactivateLicense = function (email, password, product, callback) {
    loginToXamarin(email, password, function (err, token, userGuid) {
        if (err) {
            callback(err);
        }

        if (!token || !userGuid) {
            callback('Failed to login to Xamarin with specified email and password.');
        }

        tl.debug('Deactivate Xamarin License');

        //Read the xamarin.dat file
        var dataFileLocation = getDataFileLocation(product);
        fs.readFile(dataFileLocation, function (err, data) {
            if (err) {
                tl.debug('Failed to read datafile: ' + err);
                callback('Failed to deactivate license, only license activated by this task can be deactivated.');
            }

            //Call Xamarin activation endpoint
            var options = {
                host: 'activation.xamarin.com',
                path: '/api/deactivate.ashx?guid=' + decodeURI(userGuid) + '&token=' + encodeURI(token),
                method: 'POST',
                headers: {
                    'Host': 'activation.xamarin.com',
                    'User-Agent': 'vso-agent-tasks-Xamarin-License',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            };

            doHttpRequest(options, data, timeoutInSecs, function (err, res, output) {
                if (err) {
                    tl.debug('License deactivation failed: ' + err);
                    callback("Failed to deactivate Xamarin license.");
                }
                if (!output) {
                    tl.debug('License deactivation failed. Response code = ' + res.ResponseCode);
                    callback("Failed to deactivate Xamarin license.");
                }

                var jsonResponse = JSON.parse(output);
                if (!jsonResponse || !jsonResponse.success) {
                    tl.debug('License deactivation failed. Response not as expected: ' + output);
                    callback("Failed to deactivate Xamarin license.");
                }

                //Deactivation succeeded

                //delete license file
                var licenseLocation = getLicenseLocation(product);
                fs.unlink(licenseLocation, function (err) {
                    if (err) {
                        tl.debug('Failed to delete license file on disk: ' + err);
                        tl.warning('Failed to delete license file on disk: ' + licenseLocation);
                    }
                });
            });
        });
    });
}

if (action == 'Activate') {
    //check if already activated
    var licenseLocation = getLicenseLocation(product);
    if (fs.existsSync(licenseLocation)) {
        tl.debug('License file already exists' + licenseLocation);
        tl.exit(0); //return success
    } else {
        activateLicense(email, password, product, function (err) {
            if (err) {
                onFailedExecution(err);
            }
            tl.exit(0);
        });
    }
} else if (action == 'Deactivate') {
    deactivateLicense(email, password, product, function (err) {
        if (err) {
            onFailedExecution(err);
        }
        tl.exit(0);
    });
}