'use strict';
import { Channel } from "../models";
import * as tl from 'vsts-task-lib/task';

if (process.env["__invalid_channelobject__"] == "true") {
    let throwCount: number = 0;
    // try with non explicit version
    try {
        new Channel(null);
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new Channel(undefined);
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new Channel("");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new Channel({});
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new Channel({"channel-version": undefined, "releases.json": ""});
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new Channel({"channel-version": "2.2", "releases.json": null});
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new Channel({"channel-version": "2.2", "releases.json": ""});
    }
    catch (ex) {
        throwCount++;
    }

    if (throwCount == 7) {
        throw tl.loc("FunctionThrewAsExpected");
    }
}
else {
    let channel = new Channel({"channel-version": "2.2", "releases.json": "https://channelRelease.com"});
    if (channel.channelVersion != "2.2" || channel.releasesJsonUrl != "https://channelRelease.com") {
        throw tl.loc("first")
    }

    channel = new Channel({"channel-version": "3.x", "releases.json": "https://channelRelease.com/downloadreleases.json"});
    if (channel.channelVersion != "3.x" || channel.releasesJsonUrl != "https://channelRelease.com/downloadreleases.json") {
        throw tl.loc("second")
    }

    console.log("ChannelCreatedSuccessfully");
}