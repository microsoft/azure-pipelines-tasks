var nock = require('nock');
var azureRestUtiltiy = require('azurerest-common/azurerestutility.js');

nock('http://testwebapp.azurewebsites.net/')
    .get("/")
    .reply(200, {});

azureRestUtiltiy.testAzureWebAppAvailability('http://testwebapp.azurewebsites.net',100);