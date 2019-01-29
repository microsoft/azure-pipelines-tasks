import assert = require("assert");
import request = require('request');
import mocks = require('./mocks');
import utils = require("../src/utils");

describe('Test Utils module', function () {
    it('should generate a GUID string of correct length', () => {
        assert.equal(utils.uuidv4().length, 36);
    });

    it('should get an access token', async () => {
        assert.equal(await utils.getAccessToken("resource", "clientId", "secret"), "token");
    });
});
