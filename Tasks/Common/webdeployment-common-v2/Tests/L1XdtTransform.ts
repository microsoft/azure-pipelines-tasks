var path = require('path');
var ltx = require('ltx');
var xdtTransform = require('webdeployment-common-v2/xdttransformationutility.js');
process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] = path.join(__dirname, 'L1XdtTransform');
xdtTransform.applyXdtTransformation(path.join(__dirname, 'L1XdtTransform', 'Web_test.config'), path.join(__dirname, 'L1XdtTransform', 'Web.Debug.config'));
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = 'DefaultWorkingDirectory';