import * as assert from 'assert';
import mocha = require('mocha');
import * as utils from '../utils.js';
import path = require('path');
import tl = require("vsts-task-lib/task");

describe('ArchiveFiles L0 Suite', function () {
    before(() => { });

    after(() => { });

    const files = (n) => {
        return Array.from(
          {length: n}, (v, k) => String(k)
        )
    };

    let test = this;
    let cases = [0, 1, 10, 11, 100];
    
    tl.setResourcePath(path.join( __dirname, '..', 'task.json'));
    cases.forEach(function(numberOfFiles) {
        it('plan for ' + numberOfFiles + ' files', (done: MochaDone) => {
            test.timeout(1000);
            let max = 10;
            let plan = utils.reportArchivePlan(files(numberOfFiles), max);
            assert(plan.length == Math.min(numberOfFiles+1, max+2));
    
            done();
        });
    }) 

});