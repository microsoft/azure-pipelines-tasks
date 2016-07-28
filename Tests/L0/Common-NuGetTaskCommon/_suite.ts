/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import util = require('util');

// Paths aren't the same between compile time and run time. This will need some work
let realrequire = require;
function myrequire(module: string): any {
    return realrequire(path.join(__dirname, "../../../Tasks/NuGetInstaller/node_modules", module));
}
require = <typeof require>myrequire;


import locationHelper = require('nuget-task-common/LocationHelpers');

describe("Common-NuGetTaskCommon Suite", () => {
	
	before(done => {
		// init here
		done();
	});

	after(function() {
		
	});	
	
    it("assume pkg service from visualtudio.com", done => {
        locationHelper.assumeNuGetUriPrefixes("https://contoso.visualstudio.com/foo")
            .then(assumedPrefixes => {
                assert.strictEqual(assumedPrefixes.length, 2, "should have exactly two prefix results");
                assert(assumedPrefixes.indexOf("https://contoso.pkgs.visualstudio.com/foo") !== -1, "should contain a pkgs host");
                assert(assumedPrefixes.indexOf("https://contoso.visualstudio.com/foo") !== -1, "should contain the original string");
                done();
            })
            .fail(done);
    });

    it("assume no pkg service from not visualtudio.com", done => {
        locationHelper.assumeNuGetUriPrefixes("https://contoso.example.com/foo")
            .then(assumedPrefixes => {
                assert.strictEqual(assumedPrefixes.length, 1, "should have exactly one prefix result")
                assert(assumedPrefixes.indexOf("https://contoso.example.com/foo") !== -1, "should contain the original string");
                done();
            })
            .fail(done)
    });

    it("assume no pkg service from localhost", done => {
        locationHelper.assumeNuGetUriPrefixes("https://localhost/foo")
            .then(assumedPrefixes => {
                assert.strictEqual(assumedPrefixes.length, 1, "should have exactly one prefix result")
                assert(assumedPrefixes.indexOf("https://localhost/foo") !== -1, "should contain the original string");
                done();
            })
            .fail(done);
    });
});