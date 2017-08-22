var fs = require('fs');
var path = require('path');
var util = require('./ci-util');

// get branch/commit info
var refs = util.getRefs();

// build the packages.config content
var content = [];
content.push('<?xml version="1.0" encoding="utf-8"?>');
content.push('<packages>');
Object.keys(refs.releases)
    .sort()
    .reverse()
    .forEach(function (release) {
        // skip the current release (already covered by current build)
        if (release == refs.head.release) {
            return;
        }

        var commit = refs.releases[release].commit;
        content.push(`  <package id="vsts-tasks-milestone" version="1.0.0-m${release}-${commit}" />`)
    });
content.push('</packages>');
content = content.join('\n');

// write the packages.config
var configPath = path.join(util.packagePath, 'packages.config');
fs.writeFileSync(configPath, content);

// create the restore path
fs.mkdirSync(util.restorePath);
