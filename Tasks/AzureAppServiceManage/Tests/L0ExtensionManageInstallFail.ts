var nock = require('nock');
var extensionManage = require('../extensionmanage.js');
var extensionManageUtility = require('./L0ExtensionMangeUtility.js');

nock('https://mytestappKuduUrl.scm.azurewebsites.net:443')
  .intercept('/api/siteextensions/ComposerExtension', 'PUT')
  .reply(299, {'ethuku!': '1'});

extensionManage.installExtension(extensionManageUtility.mockPublishProfile, 'ComposerExtension');