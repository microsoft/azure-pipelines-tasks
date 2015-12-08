/// <reference path="../../../definitions/node.d.ts" />

import path = require('path');

var answerFile = process.env['MOCK_RESPONSES'];
if (!answerFile) {
    throw new Error('MOCK_RESPONSES envvar not set');
}

var answers = require(answerFile);
if (!answers) {
    throw new Error('Answer file not found: ' + answerFile);
}

export function getResponse(cmd: string, key: string): any {
    if (!answers[cmd]) {
        return null;
    }

    return answers[cmd][key];
}