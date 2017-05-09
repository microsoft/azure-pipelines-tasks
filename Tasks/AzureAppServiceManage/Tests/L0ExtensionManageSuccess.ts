var nock = require('nock');
var extensionManage = require('../extensionmanage.js');
var extensionManageUtility = require('./L0ExtensionMangeUtility.js');

nock('https://mytestappKuduUrl.scm.azurewebsites.net:443')
    .get('/api/siteextensions/')
    .reply(200, extensionManageUtility.installedExtensions);

nock('https://mytestappKuduUrl.scm.azurewebsites.net:443')
  .intercept('/api/siteextensions/python2713x86', 'PUT')
  .reply(200, extensionManageUtility.installExtensionSuccess);

extensionManage.installExtensions(extensionManageUtility.mockPublishProfile, ['ComposerExtension', 'python2713x86'], []);