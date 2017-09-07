import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as path from 'path';
import tl = require('vsts-task-lib');

var hbs = require('handlebars').create();

describe('Download Jenkins Artifact Details L0 Suite', function () {
    this.timeout(20000);

    // before((done) => {
    //     process.env['ENDPOINT_AUTH_ID1'] = '{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}';
    //     process.env['ENDPOINT_URL_ID1'] = 'bogusURL';

    //     done();
    // });
    before(function () { });
    after(function () { });

    it('Should download commits and workitems from single build', (done) => {

        const tp: string = path.join(__dirname, 'L0DownloadCommitsAndWorkItemsFromSingleBuild.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();
            assert(tr.stdout.indexOf('vso') === -1 , tr.stdout);
            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });
});
