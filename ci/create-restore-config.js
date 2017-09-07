var fs = require('fs');
var path = require('path');
var syncRequest = require('sync-request');
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

        // relax the commit constraint to 1 hour when building the aggregate package for master
        if (refs.head.branch == 'refs/heads/master') {
            while (true) {
                var packageUrl = process.env.PACKAGE_URL_FORMAT
                    .replace('{FEED_NAME}', encodeURIComponent(process.env.TASK_MILESTONE_FEED_NAME))
                    .replace('{PACKAGE_NAME}', encodeURIComponent('vsts-tasks-milestone'))
                    .replace('{VERSION}', encodeURIComponent(`1.0.0-m${release}-${commit}`));
                console.log(`Checking whether package exists: ${packageUrl}`);
                var options = { headers: { Authorization: `Bearer ${process.env.SYSTEM_ACCESSTOKEN}` } };
                var response = syncRequest('GET', packageUrl, options);
                if (response.statusCode == 200) {
                    break;
                }

                if (response.statusCode == 404) {
                    // get the time of the commit. if it is within an hour, get the parent commit.
                }

                throw new Error(`Unexpected HTTP response '${response.statusCode}'`);
            }
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
