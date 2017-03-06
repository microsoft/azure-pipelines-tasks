/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import util = require('util');

let locationHelper = require('../../../Tasks/Common/nuget-task-common/LocationHelpers');
let NuGetQuirkName = require('../../../Tasks/Common/nuget-task-common/NuGetQuirks').NuGetQuirkName;
let NuGetQuirks = require('../../../Tasks/Common/nuget-task-common/NuGetQuirks').NuGetQuirks;
let VersionInfoVersion = require('../../../Tasks/Common/nuget-task-common/pe-parser/VersionInfoVersion').VersionInfoVersion;

describe("Common-NuGetTaskCommon Suite", () => {

    before(done => {
        // init here
        done();
    });

    after(function () {

    });
    describe("assumeNuGetUriPrefixes", function () {
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

    describe("NuGetQuirks", function () {
        // interface VersionQuirks {
        //     version: VersionInfoVersion;
        //     displayVersion: string;
        //     quirks: Set<NuGetQuirkName>;
        // }

        let expectedQuirksByVersion/*: VersionQuirks[]*/ = [
            {
                version: new VersionInfoVersion(2, 8, 60717, 93),
                displayVersion: "2.8.6",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig,
                    NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
                    NuGetQuirkName.NoCredentialProvider,
                    NuGetQuirkName.NoV3,
                ])
            },
            {
                version: new VersionInfoVersion(3, 2, 0, 10516),
                displayVersion: "3.2.0",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig,
                    NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
                    NuGetQuirkName.CredentialProviderRace,
                ])
            },
            {
                version: new VersionInfoVersion(3, 3, 0, 212),
                displayVersion: "3.3.0",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig,
                    NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
                    NuGetQuirkName.CredentialProviderRace,
                    NuGetQuirkName.RelativeRepositoryPathBug,
                    NuGetQuirkName.NtlmReAuthBug,
                ])
            },
            {
                version: new VersionInfoVersion(3, 4, 4, 1321),
                displayVersion: "3.4.4-rtm-1321",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig,
                    NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
                    NuGetQuirkName.CredentialProviderRace,
                ])
            },
            {
                version: new VersionInfoVersion(3, 5, 0, 1520),
                displayVersion: "3.5.0-beta2-1520",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig,
                    NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
                    NuGetQuirkName.CredentialProviderRace,
                ])
            },
            {
                version: new VersionInfoVersion(3, 5, 0, 1737),
                displayVersion: "3.5.0-rtm-1737",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig,
                    NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
                ])
            },
            {
                version: new VersionInfoVersion(3, 5, 1, 1621),
                displayVersion: "3.5.1-beta1-1621",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig,
                    NuGetQuirkName.CredentialProviderRace,
                ])
            },
            {
                version: new VersionInfoVersion(3, 5, 1, 1707),
                displayVersion: "3.5.1-beta1-1707",
                quirks: new Set([
                    NuGetQuirkName.NoTfsOnPremAuthConfig
                ])
            }
        ]

        for (const expected of expectedQuirksByVersion) {
            it(`Has the expected quirks for NuGet ${expected.displayVersion} (${expected.version})`, function () {
                const actualQuirks = new Set(NuGetQuirks.fromVersion(expected.version).quirks);
                for (const quirkInExpectedSet of expected.quirks) {
                    assert(
                        actualQuirks.has(quirkInExpectedSet),
                        `version should report quirk ${NuGetQuirkName[quirkInExpectedSet]}, but does not`);
                }

                for (const quirkInActualSet of actualQuirks) {
                    assert(
                        expected.quirks.has(quirkInActualSet),
                        `version unexpectedly reports quirk ${NuGetQuirkName[quirkInActualSet as any]}`
                    )
                }
            })
        }
    })
});