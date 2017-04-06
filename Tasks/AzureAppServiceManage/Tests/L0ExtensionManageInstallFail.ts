var nock = require('nock');
var extensionManage = require('../extensionmanage.js');
var extensionManageUtility = require('./L0ExtensionMangeUtility.js');

nock('https://mytestappKuduUrl.scm.azurewebsites.net:443')
  .intercept('/api/siteextensions/ComposerExtension', 'PUT')
  .reply(500, 'ethuku!');

extensionManage.installExtension(extensionManageUtility.mockPublishProfile, 'ComposerExtension');