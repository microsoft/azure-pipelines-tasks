import request = require('request');

// Mock HTTP POST requests
function mockPost(): request.Request {
    if (arguments.length !== 3) {
        throw new Error("Unsupported argument array length: " + arguments.length);
    }

    if (arguments[0] === "https://login.windows.net/microsoft.onmicrosoft.com/oauth2/token") {
        arguments[2](/*error*/null, /*response*/{ statusCode: 200 }, /*body*/JSON.stringify({ access_token: "token" }));
    } else if (arguments[0] === "https://cluster.kusto.windows.net/v1/rest/mgmt") {
        arguments[2](/*error*/null, /*response*/{ statusCode: 200 }, /*body*/{});
    } else {
        throw new Error("Unhandled URL: " + arguments[0])
    }

    return null;
}
request.post = mockPost;
