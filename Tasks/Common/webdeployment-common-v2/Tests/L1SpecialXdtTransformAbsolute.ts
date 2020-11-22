var path = require('path');
var ltx = require('ltx');
var xdtTransform = require('webdeployment-common-v2/xdttransformationutility.js');
var workingDirectory = path.join(__dirname, 'L1XdtTransform');
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] = workingDirectory;
xdtTransform.specialXdtTransformation(workingDirectory, path.join(workingDirectory, 'Web.Debug.config'), 'Web_test.config');
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = 'DefaultWorkingDirectory';