var nock = require('nock');
var azureRestUtiltiy = require('../azurerestutility.js');

nock('http://testwebapp.azurewebsites.net/')
    .get("/")
    .reply(200, {});

azureRestUtiltiy.warmupAzureAppService('http://testwebapp.azurewebsites.net')