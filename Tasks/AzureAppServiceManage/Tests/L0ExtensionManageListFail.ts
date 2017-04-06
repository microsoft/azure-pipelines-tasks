var nock = require('nock');
var extensionManage = require('../extensionmanage.js');
var extensionManageUtility = require('./L0ExtensionMangeUtility.js');

nock('https://mytestappKuduUrl.scm.azurewebsites.net:443')
    .get('/api/siteextensions/')
    .reply(500, extensionManageUtility.installedExtensions);

extensionManage.getInstalledExtensions(extensionManageUtility.mockPublishProfile);