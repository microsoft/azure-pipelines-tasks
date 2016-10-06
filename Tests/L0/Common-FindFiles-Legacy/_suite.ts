/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
let ff = require('../../../Tasks/Common/find-files-legacy/findfiles.legacy');

describe('Code Coverage enable tool tests', function () {
    this.timeout(20000);

    let data = path.join(__dirname, 'data');

    before((done) => {
        Q.longStackSupport = true;
        done();
    });

    after(function () {
    });

    it('Search simple pattern', (done) => {
        let test = ff.findFiles(path.join(data, '*.log'));
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search multiple patterns', (done) => {
        let test = ff.findFiles([path.join(data, '*.log'), path.join(data, '*.txt')]);
        assert(test.length === 4);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        assert(test[2] === posixFormat(path.join(data, 'a.txt')));
        assert(test[3] === posixFormat(path.join(data, 'b.txt')));
        done();
    });

    it('Search simple pattern with (+:) filter', (done) => {
        let test = ff.findFiles('+:' + path.join(data, '*.log'));
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search multiple patterns with (+:) filter', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '*.log'), '+:' + path.join(data, '*.txt')]);
        assert(test.length === 4);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        assert(test[2] === posixFormat(path.join(data, 'a.txt')));
        assert(test[3] === posixFormat(path.join(data, 'b.txt')));
        done();
    });

    it('Search simple pattern with (+:) filter and (-:) filter', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '*.log'), '-:' + path.join(data, 'a*')]);
        assert(test.length === 1);
        assert(test[0] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search simple pattern with exclude files', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '*'), '-:' + path.join(data, 'a*')]);
        assert(test.length === 3);
        done();
    });

    it('Search recursively with include files', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '**', '*.log')]);
        assert(test.length === 4);
        done();
    });

    it('Search recursively with exclude files', (done) => {
        let test = ff.findFiles([path.join(data, '**', '*'), '-:' + path.join(data, '**', '*.log')]);
        assert(test.length === 6);
        done();
    });

    it('Search recursively with include files and exclude files', (done) => {
        let test = ff.findFiles(['+:' + path.join(data, '**', '*.log'), '-:' + path.join(data, '**', 'a*')]);
        assert(test.length === 2);
        done();
    });

    it('Search recursively with exclude files with ignore dir', (done) => {
        let test = ff.findFiles([path.join(data, '**', '*'), '-:' + path.join(data, '**', '*.log')], true);
        assert(test.length === 7);
        done();
    });

    it('Search simple pattern (relative path) starting with ..', (done) => {
        let relativePath = path.relative(process.cwd(), path.join(__dirname, 'data', '*.log'));
        let test = ff.findFiles(relativePath);
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search simple pattern (relative path)', (done) => {
        let relativePath = path.relative(process.cwd(), path.join(__dirname, 'data', '*.log'));
        let test = ff.findFiles(path.join('L0', '..' , relativePath));
        assert(test.length === 2);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        done();
    });

    it('Search pattern seperated by semi-colon(delimiter)', (done) => {
        let test = ff.findFiles(path.join(data, '*.log') + ";" +path.join(data, '*.txt'));
        assert(test.length === 4);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        assert(test[1] === posixFormat(path.join(data, 'b.log')));
        assert(test[2] === posixFormat(path.join(data, 'a.txt')));
        assert(test[3] === posixFormat(path.join(data, 'b.txt')));
        done();
    });
    
    it('Search pattern seperated by semi-colon(delimiter)', (done) => {
        let test = ff.findFiles(path.join(data, 'a*') + ";-:" + path.join(data, 'a.txt'));
        assert(test.length === 1);
        assert(test[0] === posixFormat(path.join(data, 'a.log')));
        done();
    });
});

function posixFormat(p: string): string {
    let path_regex = /\/\//;
    p = p.replace(/\\/g, '/');
    while (p.match(path_regex)) {
        p = p.replace(path_regex, '/');
    }
    return p;
}
