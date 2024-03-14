var nock = require('nock');
var azureRestUtiltiy = require('azurerest-common/azurerestutility.js');

nock('http://testwebapp.azurewebsites.net')
    .get("/")
    .reply(299, {"statusCode":"299", "statusMessage": "Fail"});

azureRestUtiltiy.testAzureWebAppAvailability('http://testwebapp.azurewebsites.net',100);