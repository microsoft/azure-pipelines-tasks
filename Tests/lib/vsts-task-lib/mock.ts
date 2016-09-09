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

    if (!answers[cmd][key] && key && process.env['MOCK_NORMALIZE_SLASHES'] === 'true') {
        // try normalizing the slashes
        var key2 = key.replace(/\\/g, "/");
        if (answers[cmd][key2]) {
            return answers[cmd][key2];
        } 
    }
    if (!answers[cmd][key] && key && process.env['MOCK_WILDCARD_ACCEPTED'] === 'true') {
        // try Searching for wildcards
        var values = Object.keys(answers[cmd]);
        var temp = key;
        var isAMatch = null;
        var compareResult = null;
        values.forEach(function (value) {
            isAMatch = key.match(value);
            if (isAMatch) {
                if((compareResult && isAMatch[0].length > compareResult.length) || !compareResult)
                {
                    temp = value;
                    compareResult = isAMatch[0];
                }
            }
        });
        key = temp;
    }
    return answers[cmd][key];
}