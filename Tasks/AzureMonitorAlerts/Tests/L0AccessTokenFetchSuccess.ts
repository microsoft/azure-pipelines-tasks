import * as querystring from "querystring";
import * as assert from "assert";
import { HttpClient } from "typed-rest-client/HttpClient";
import { AuthorizationClient } from "../authorizationclient";

var nock = require("nock");

let endpoint = {
	url: "http://example.com/",
	tenantID: "tenantId",
	servicePrincipalKey: "spKey",
	servicePrincipalClientID: "spId",
	activeDirectoryResourceId: "http://example.com/"
};

let httpClient = new HttpClient("TEST_AGENT");

async function testGetBearerToken1() {
	try {
		let authorizationclient = new AuthorizationClient(endpoint, httpClient);

		mockRequest("accessToken", `${Math.floor(new Date().getTime()/1000) + 3600}`);
		let token1 = await authorizationclient.getBearerToken();
		let token2 = await authorizationclient.getBearerToken();

		assert(token1 === "accessToken", "new access token should have been returned");
		assert(token2 === "accessToken", "stored access token should have been returned");
	}
	catch (error) {
		console.error(error);
	}
}

async function testGetBearerToken2() {
	try {
		let authorizationclient = new AuthorizationClient(endpoint, httpClient);

		mockRequest("accessToken1", `${Math.floor(new Date().getTime()/1000)}`);
		mockRequest("accessToken2", `${Math.floor(new Date().getTime()/1000)}`);
		let token1 = await authorizationclient.getBearerToken();
		let token2 = await authorizationclient.getBearerToken();

		assert(token1 === "accessToken1", "new access token should have been returned");
		assert(token2 === "accessToken2", "new access token should have been returned");
	}
	catch (error) {
		console.error(error);
	}
}

function mockRequest(accessToken, expiryTime) {
	nock("https://login.windows.net", {
		reqheaders: {
        	"content-type": "application/x-www-form-urlencoded; charset=utf-8",
    		"user-agent": "TEST_AGENT"
      	}
	})
	.post("/tenantId/oauth2/token/", querystring.stringify({
		resource: "http://example.com/",
		client_id: "spId",
		grant_type: "client_credentials",
		client_secret: "spKey"
	}))
	.reply(200, { 
		access_token: accessToken,
		expires_on: expiryTime
	});
}

testGetBearerToken1();
testGetBearerToken2();



