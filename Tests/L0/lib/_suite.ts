/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');

var ps = shell.which('powershell');
console.log(ps);

describe('Test Helpers Suite', function() {
    this.timeout(10000);
	
	before((done) => {
		// init here
		done();
	});

	after(function() {
		
	});

	if (ps) {
		it('asserts was called when arguments match', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.Arguments.ps1'), done);
		})

		it('throws was not called when arguments do not match', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.Arguments.Throws.ps1'), done);
		})

		it('asserts was called when arguments evaluator matches', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.ArgumentsEvaluator.ps1'), done);
		})

		it('throws was not called when arguments evaluator does not match', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.ArgumentsEvaluator.Throws.ps1'), done);
		})

		it('asserts was called when parameters evaluator matches', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.ParametersEvaluator.ps1'), done);
		})

		it('throws was not called when parameters evaluator does not match', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.ParametersEvaluator.Throws.ps1'), done);
		})

		it('asserts was called', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.ps1'), done);
		})

		it('throws was not called', (done) => {
			psm.runPS(path.join(__dirname, 'AssertWasCalled.Throws.ps1'), done);
		})

		it('does not invoke the delegate when arguments do not match', (done) => {
			psm.runPS(path.join(__dirname, 'RegisterMock.Arguments.NotMatched.ps1'), done);
		})

		it('invokes the delegate when arguments match', (done) => {
			psm.runPS(path.join(__dirname, 'RegisterMock.Arguments.ps1'), done);
		})

		it('does not invoke the delegate when arguments evaluator does not match', (done) => {
			psm.runPS(path.join(__dirname, 'RegisterMock.ArgumentsEvaluator.NotMatched.ps1'), done);
		})

		it('invokes the delegate when arguments evaluator matches', (done) => {
			psm.runPS(path.join(__dirname, 'RegisterMock.ArgumentsEvaluator.ps1'), done);
		})

		it('does not invoke the delegate when parameters evaluator does not match', (done) => {
			psm.runPS(path.join(__dirname, 'RegisterMock.ParametersEvaluator.NotMatched.ps1'), done);
		})

		it('invokes the delegate when parameters evaluator matches', (done) => {
			psm.runPS(path.join(__dirname, 'RegisterMock.ParametersEvaluator.ps1'), done);
		})

		it('invokes the delegate', (done) => {
			psm.runPS(path.join(__dirname, 'RegisterMock.ps1'), done);
		})
	}

});