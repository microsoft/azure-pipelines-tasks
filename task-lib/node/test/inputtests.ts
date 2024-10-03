// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import path = require('path');
import os = require('os');
import * as tl from '../_build/task';
import * as im from '../_build/internal';
import testutil = require('./testutil');

describe('Input Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });

    it('gets input value', function (done) {
        this.timeout(1000);

        process.env['INPUT_UNITTESTINPUT'] = 'test value';
        im._loadData();

        var inval = tl.getInput('UnitTestInput', true);
        assert.equal(inval, 'test value');

        done();
    })
    it('should clear input envvar', function (done) {
        this.timeout(1000);

        process.env['INPUT_UNITTESTINPUT'] = 'test value';
        im._loadData();
        var inval = tl.getInput('UnitTestInput', true);
        assert.equal(inval, 'test value');
        assert(!process.env['INPUT_UNITTESTINPUT'], 'input envvar should be cleared');

        done();
    })
    it('required input throws', function (done) {
        this.timeout(1000);

        var worked: boolean = false;
        try {
            var inval = tl.getInput('SomeUnsuppliedRequiredInput', true);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'req input should have not have worked');

        done();
    })

    it('gets input value', function (done) {
        this.timeout(1000);

        process.env['INPUT_UNITTESTINPUT'] = 'test value';
        im._loadData();

        var inval = tl.getInputRequired('UnitTestInput');
        assert.strictEqual(inval, 'test value');

        done();
    })
    it('should clear input envvar', function (done) {
        this.timeout(1000);

        process.env['INPUT_UNITTESTINPUT'] = 'test value';
        im._loadData();
        var inval = tl.getInputRequired('UnitTestInput');
        assert.strictEqual(inval, 'test value');
        assert(!process.env['INPUT_UNITTESTINPUT'], 'input envvar should be cleared');

        done();
    })
    it('required input throws', function (done) {
        this.timeout(1000);

        var worked: boolean = false;
        try {
            var inval = tl.getInputRequired('SomeUnsuppliedRequiredInput');
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'req input should have not have worked');

        done();
    })

    // getVariable tests
    it('gets a variable', function (done) {
        this.timeout(1000);

        process.env['BUILD_REPOSITORY_NAME'] = 'Test Repository';
        im._loadData();

        var varVal = tl.getVariable('Build.Repository.Name');
        assert.equal(varVal, 'Test Repository');

        done();
    })
    it('gets a secret variable', function (done) {
        this.timeout(1000);

        process.env['SECRET_BUILD_REPOSITORY_NAME'] = 'Test Repository';
        im._loadData();

        var varVal = tl.getVariable('Build.Repository.Name');
        assert.equal(varVal, 'Test Repository');

        done();
    })
    it('gets a secret variable while variable also exist', function (done) {
        this.timeout(1000);

        process.env['BUILD_REPOSITORY_NAME'] = 'Test Repository';
        process.env['SECRET_BUILD_REPOSITORY_NAME'] = 'Secret Test Repository';
        im._loadData();

        var varVal = tl.getVariable('Build.Repository.Name');
        assert.equal(varVal, 'Secret Test Repository');

        done();
    })
    it('gets a variable with special characters', (done) => {
        this.timeout(1000);

        let expected = 'Value of var with special chars';
        process.env['HELLO_DOT_DOT2_SPACE_SPACE2'] = expected;
        im._loadData();

        let varVal = tl.getVariable('Hello.dot.dot2 space space2');
        assert.equal(varVal, expected);

        done();
    })

    // setVariable tests
    it('sets a variable as an env var', function (done) {
        this.timeout(1000);

        tl.setVariable('Build.Repository.Uri', 'test value');
        let varVal: string = process.env['BUILD_REPOSITORY_URI'];
        assert.equal(varVal, 'test value');

        done();
    })
    it('sets a variable with special chars as an env var', (done) => {
        this.timeout(1000);

        let expected = 'Set value of var with special chars';
        tl.setVariable('Hello.dot.dot2 space space2', expected);
        let varVal: string = process.env['HELLO_DOT_DOT2_SPACE_SPACE2'];
        assert.equal(varVal, expected);

        done();
    })
    it('sets and gets a variable', function (done) {
        this.timeout(1000);

        tl.setVariable('UnitTestVariable', 'test var value');
        let varVal: string = tl.getVariable('UnitTestVariable');
        assert.equal(varVal, 'test var value');

        done();
    })
    it('sets and gets an output variable', function (done) {
        this.timeout(1000);

        tl.setVariable('UnitTestVariable', 'test var value', false, true);
        let varVal: string = tl.getVariable('UnitTestVariable');
        assert.equal(varVal, 'test var value');

        done();
    })
    it('sets and gets a secret variable', function (done) {
        this.timeout(1000);

        tl.setVariable('My.Secret.Var', 'test secret value', true);
        let varVal: string = tl.getVariable('My.Secret.Var');
        assert.equal(varVal, 'test secret value');

        done();
    })
    it('does not set a secret variable as an env var', function (done) {
        this.timeout(1000);

        delete process.env['MY_SECRET_VAR'];
        tl.setVariable('My.Secret.Var', 'test secret value', true);
        let envVal: string = process.env['MY_SECRET_VAR'];
        assert(!envVal, 'env var should not be set');

        done();
    })
    it('removes env var when sets a secret variable', function (done) {
        this.timeout(1000);

        process.env['MY_SECRET_VAR'] = 'test env value';
        tl.setVariable('My.Secret.Var', 'test secret value', true);
        let envVal: string = process.env['MY_SECRET_VAR'];
        assert(!envVal, 'env var should not be set');

        done();
    })
    it('does not allow a secret variable to become a public variable', function (done) {
        this.timeout(1000);

        im._loadData();
        tl.setVariable('My.Secret.Var', 'test secret value', true);
        tl.setVariable('My.Secret.Var', 'test modified value', false);
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert.equal(vars.length, 1);
        assert.equal(vars[0].name, 'My.Secret.Var');
        assert.equal(vars[0].value, 'test modified value');
        assert.equal(vars[0].secret, true);

        done();
    })
    it('allows a public variable to become a secret variable', function (done) {
        this.timeout(1000);

        im._loadData();
        tl.setVariable('My.Var', 'test value', false);
        tl.setVariable('My.Var', 'test modified value', true);
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert.equal(vars.length, 1);
        assert.equal(vars[0].name, 'My.Var');
        assert.equal(vars[0].value, 'test modified value');
        assert.equal(vars[0].secret, true);

        done();
    })
    it('tracks known variables using env formatted name', function (done) {
        this.timeout(1000);

        im._loadData();
        tl.setVariable('My.Public.Var', 'test value');
        tl.setVariable('my_public.VAR', 'test modified value');
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert.equal(vars.length, 1);
        assert.equal(vars[0].name, 'my_public.VAR');
        assert.equal(vars[0].value, 'test modified value');

        done();
    })
    it('does not allow setting a multi-line secret variable', function (done) {
        this.timeout(1000);

        im._loadData();

        // test carriage return
        let failed = false;
        try {
            tl.setVariable('my.secret', 'line1\rline2', true);
        }
        catch (err) {
            failed = true;
        }
        assert(failed, 'Should have failed setting a secret variable with a carriage return');

        // test line feed
        failed = false;
        try {
            tl.setVariable('my.secret', 'line1\nline2', true);
        }
        catch (err) {
            failed = true;
        }
        assert(failed, 'Should have failed setting a secret variable with a line feed');

        done();
    })
    it('allows unsafe setting a multi-line secret variable', function (done) {
        this.timeout(1000);

        im._loadData();
        try {
            process.env['SYSTEM_UNSAFEALLOWMULTILINESECRET'] = 'true';
            tl.setVariable('my.secret', 'line1\r\nline2', true);
        }
        finally {
            delete process.env['SYSTEM_UNSAFEALLOWMULTILINESECRET'];
        }

        assert.equal(tl.getVariable('my.secret'), 'line1\r\nline2');

        done();
    })

    // setSecret tests
    it('does not allow setting a multi-line secret', function (done) {
        this.timeout(1000);

        im._loadData();

        // test carriage return
        let failed = false;
        try {
            tl.setSecret('line1\rline2');
        }
        catch (err) {
            failed = true;
        }
        assert(failed, 'Should have failed setting a secret with a carriage return');

        // test line feed
        failed = false;
        try {
            tl.setSecret('line1\nline2');
        }
        catch (err) {
            failed = true;
        }
        assert(failed, 'Should have failed setting a secret with a line feed');

        done();
    })
    it('allows unsafe setting a multi-line secret', function (done) {
        this.timeout(1000);

        im._loadData();
        try {
            process.env['SYSTEM_UNSAFEALLOWMULTILINESECRET'] = 'true';
            tl.setSecret('line1\r\nline2');
        }
        finally {
            delete process.env['SYSTEM_UNSAFEALLOWMULTILINESECRET'];
        }

        done();
    })

    // getVariables tests
    it('gets public variables from initial load', function (done) {
        this.timeout(1000);

        process.env['PUBLIC_VAR_ONE'] = 'public value 1';
        process.env['PUBLIC_VAR_TWO'] = 'public value 2';
        process.env['VSTS_PUBLIC_VARIABLES'] = '[ "Public.Var.One", "Public.Var.Two" ]';
        im._loadData();
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert(vars, 'variables should not be undefined or null');
        assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
        vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
        assert.equal(vars[0].name, 'Public.Var.One');
        assert.equal(vars[0].value, 'public value 1');
        assert.equal(vars[0].secret, false);
        assert.equal(vars[1].name, 'Public.Var.Two');
        assert.equal(vars[1].value, 'public value 2');
        assert.equal(vars[1].secret, false);

        done();
    })
    it('gets secret variables from initial load', function (done) {
        this.timeout(1000);

        process.env['SECRET_SECRET_VAR_ONE'] = 'secret value 1';
        process.env['SECRET_SECRET_VAR_TWO'] = 'secret value 2';
        process.env['VSTS_SECRET_VARIABLES'] = '[ "Secret.Var.One", "Secret.Var.Two" ]';
        im._loadData();
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert(vars, 'variables should not be undefined or null');
        assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
        vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
        assert.equal(vars[0].name, 'Secret.Var.One');
        assert.equal(vars[0].value, 'secret value 1');
        assert.equal(vars[0].secret, true);
        assert.equal(vars[1].name, 'Secret.Var.Two');
        assert.equal(vars[1].value, 'secret value 2');
        assert.equal(vars[1].secret, true);

        done();
    })
    it('gets secret variables from initial load in pre 2.104.1 agent', function (done) {
        this.timeout(1000);

        process.env['SECRET_SECRET_VAR_ONE'] = 'secret value 1';
        process.env['SECRET_SECRET_VAR_TWO'] = 'secret value 2';
        im._loadData();
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert(vars, 'variables should not be undefined or null');
        assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
        vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
        assert.equal(vars[0].name, 'SECRET_VAR_ONE');
        assert.equal(vars[0].value, 'secret value 1');
        assert.equal(vars[0].secret, true);
        assert.equal(vars[1].name, 'SECRET_VAR_TWO');
        assert.equal(vars[1].value, 'secret value 2');
        assert.equal(vars[1].secret, true);

        done();
    })
    it('gets public variables from setVariable', function (done) {
        this.timeout(1000);

        process.env['INITIAL_PUBLIC_VAR'] = 'initial public value';
        process.env['VSTS_PUBLIC_VARIABLES'] = '[ "Initial.Public.Var" ]';
        im._loadData();
        tl.setVariable('Set.Public.Var', 'set public value');
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert(vars, 'variables should not be undefined or null');
        assert.equal(vars.length, 2, 'exactly 4 variables should be returned');
        vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
        assert.equal(vars[0].name, 'Initial.Public.Var');
        assert.equal(vars[0].value, 'initial public value');
        assert.equal(vars[0].secret, false);
        assert.equal(vars[1].name, 'Set.Public.Var');
        assert.equal(vars[1].value, 'set public value');
        assert.equal(vars[1].secret, false);

        done();
    })
    it('gets secret variables from setVariable', function (done) {
        this.timeout(1000);

        process.env['SECRET_INITIAL_SECRET_VAR'] = 'initial secret value';
        process.env['VSTS_SECRET_VARIABLES'] = '[ "Initial.Secret.Var" ]';
        im._loadData();
        tl.setVariable('Set.Secret.Var', 'set secret value', true);
        let vars: tl.VariableInfo[] = tl.getVariables();
        assert(vars, 'variables should not be undefined or null');
        assert.equal(vars.length, 2, 'exactly 2 variables should be returned');
        vars = vars.sort((a: tl.VariableInfo, b: tl.VariableInfo) => a.name.localeCompare(b.name));
        assert.equal(vars[0].name, 'Initial.Secret.Var');
        assert.equal(vars[0].value, 'initial secret value');
        assert.equal(vars[0].secret, true);
        assert.equal(vars[1].name, 'Set.Secret.Var');
        assert.equal(vars[1].value, 'set secret value');
        assert.equal(vars[1].secret, true);

        done();
    })

    // getEndpointUrl/getEndpointAuthorization/getEndpointData tests
    it('gets an endpoint url', function (done) {
        this.timeout(1000);

        process.env['ENDPOINT_URL_id1'] = 'http://url';
        im._loadData();

        var url = tl.getEndpointUrl('id1', true);
        assert.equal(url, 'http://url', 'url should match');

        done();
    })
    it('gets a required endpoint url', function (done) {
        this.timeout(1000);

        process.env['ENDPOINT_URL_id1'] = 'http://url';
        im._loadData();

        var url = tl.getEndpointUrlRequired('id1');
        assert.equal(url, 'http://url', 'url should match');

        done();
    })
    it('required endpoint url throws', function (done) {
        this.timeout(1000);

        im._loadData();

        var worked: boolean = false;
        try {
            var url = tl.getEndpointUrlRequired('SomeUnsuppliedRequiredInput');
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'req endpoint url should have not have worked');

        done();
    })
    it('gets an endpoint auth', function (done) {
        this.timeout(1000);

        process.env['ENDPOINT_AUTH_id1'] = '{ "parameters": {"param1": "val1", "param2": "val2"}, "scheme": "UsernamePassword"}';
        im._loadData();

        var auth = tl.getEndpointAuthorization('id1', true);
        assert(auth, 'should return an auth obj');
        assert.equal(auth['parameters']['param1'], 'val1', 'should be correct object');

        done();
    })
    it('gets null if endpoint auth not set', function (done) {
        this.timeout(1000);

        // don't set
        im._loadData();

        var auth = tl.getEndpointAuthorization('id1', true);
        assert.equal(auth, null, 'should not return an auth obj');

        done();
    })
    it('should clear auth envvar', function (done) {
        this.timeout(1000);

        process.env['ENDPOINT_AUTH_id1'] = '{ "parameters": {"param1": "val1", "param2": "val2"}, "scheme": "UsernamePassword"}';
        im._loadData();
        var auth = tl.getEndpointAuthorization('id1', true);
        assert(auth, 'should return an auth obj');
        assert(auth['parameters']['param1'] === 'val1', 'should be correct object');
        assert(!process.env['ENDPOINT_AUTH_id1'], 'should clear auth envvar');

        done();
    })
    it('gets endpoint auth scheme', function (done) {
        this.timeout(1000);
        process.env['ENDPOINT_AUTH_SCHEME_id1'] = 'scheme1';
        im._loadData();

        var data = tl.getEndpointAuthorizationScheme('id1', true);
        assert(data, 'should return a string value');
        assert.equal(data, 'scheme1', 'should be correct scheme');
        assert(!process.env['ENDPOINT_AUTH_SCHEME_id1'], 'should clear auth envvar');

        done();
    })
    it('gets undefined if endpoint auth scheme is not set', function (done) {
        this.timeout(1000);
        im._loadData();

        var data = tl.getEndpointAuthorizationScheme('id1', true);
        assert(!data, 'should be undefined when auth scheme is not set');

        done();
    })
    it('gets required endpoint auth scheme', function (done) {
        this.timeout(1000);
        process.env['ENDPOINT_AUTH_SCHEME_id1'] = 'scheme1';
        im._loadData();

        var data = tl.getEndpointAuthorizationSchemeRequired('id1');
        assert(data, 'should return a string value');
        assert.equal(data, 'scheme1', 'should be correct scheme');
        assert(!process.env['ENDPOINT_AUTH_SCHEME_id1'], 'should clear auth envvar');

        done();
    })
    it('required endpoint auth scheme throws', function (done) {
        this.timeout(1000);

        im._loadData();

        var worked: boolean = false;
        try {
            var data = tl.getEndpointAuthorizationSchemeRequired('SomeUnsuppliedRequiredInput');
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'req endpoint auth scheme should have not have worked');

        done();
    })
    it('gets endpoint auth parameters', function (done) {
        this.timeout(1000);
        process.env['ENDPOINT_AUTH_PARAMETER_id1_PARAM1'] = 'value1';
        im._loadData();

        var data = tl.getEndpointAuthorizationParameter('id1', 'param1', true);
        assert(data, 'should return a string value');
        assert.equal(data, 'value1', 'should be correct auth param');
        assert(!process.env['ENDPOINT_AUTH_PARAMETER_id1_PARAM1'], 'should clear auth envvar');

        done();
    })
    it('gets undefined if endpoint auth parameter is not set', function (done) {
        this.timeout(1000);
        im._loadData();

        var data = tl.getEndpointAuthorizationParameter('id1', 'noparam', true);
        assert(!data, 'should be undefined when auth param is not set');

        done();
    })
    it('gets required endpoint auth parameters', function (done) {
        this.timeout(1000);
        process.env['ENDPOINT_AUTH_PARAMETER_id1_PARAM1'] = 'value1';
        im._loadData();

        var data = tl.getEndpointAuthorizationParameterRequired('id1', 'param1');
        assert(data, 'should return a string value');
        assert.equal(data, 'value1', 'should be correct auth param');
        assert(!process.env['ENDPOINT_AUTH_PARAMETER_id1_PARAM1'], 'should clear auth envvar');

        done();
    })
    it('throws if endpoint auth parameter is not set', function (done) {
        this.timeout(1000);
        im._loadData();

        var worked: boolean = false;
        try {
            var data = tl.getEndpointAuthorizationParameterRequired('id1', 'noparam');
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'get endpoint authorization parameter should have not have worked');

        done();
    })
    it('gets an endpoint data', function (done) {
        this.timeout(1000);
        process.env['ENDPOINT_DATA_id1_PARAM1'] = 'val1';
        im._loadData();

        var data = tl.getEndpointDataParameter('id1', 'param1', true);
        assert(data, 'should return a string value');
        assert.equal(data, 'val1', 'should be correct object');

        done();
    })
    it('gets undefined if endpoint data is not set', function (done) {
        this.timeout(1000);
        im._loadData();

        var data = tl.getEndpointDataParameter('id1', 'noparam', true);
        assert.equal(data, undefined, 'Error should occur if endpoint data is not set');

        done();
    })
    it('gets required endpoint data', function (done) {
        this.timeout(1000);
        process.env['ENDPOINT_DATA_id1_PARAM1'] = 'val1';
        im._loadData();

        var data = tl.getEndpointDataParameterRequired('id1', 'param1');
        assert(data, 'should return a string value');
        assert.equal(data, 'val1', 'should be correct object');

        done();
    })
    it('throws if endpoint data is not set', function (done) {
        this.timeout(1000);
        im._loadData();

        var worked: boolean = false;
        try {
            var data = tl.getEndpointDataParameterRequired('id1', 'noparam');
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'get endpoint data should have not have worked');

        done();
    })
    // getSecureFileName/getSecureFileTicket/getSecureFiles tests
    it('gets a secure file name', function (done) {
        this.timeout(1000);

        process.env['SECUREFILE_NAME_10'] = 'securefile10.p12';
        im._loadData();

        var name = tl.getSecureFileName('10');
        assert.equal(name, 'securefile10.p12', 'name should match');

        done();
    })
    it('gets a secure file ticket', function (done) {
        this.timeout(1000);

        process.env['SECUREFILE_TICKET_10'] = 'rsaticket10';
        im._loadData();

        var ticket = tl.getSecureFileTicket('10');
        assert(ticket, 'should return a string value');
        assert.equal(ticket, 'rsaticket10', 'should be correct ticket');
        assert(!process.env['SECUREFILE_TICKET_10'], 'should clear ticket envvar');

        done();
    })
    // getBoolInput tests
    it('gets case insensitive true bool input value', function (done) {
        this.timeout(1000);

        var inputValue = 'tRuE';
        process.env['INPUT_ABOOL'] = inputValue;
        im._loadData();

        var outVal = tl.getBoolInput('abool', /*required=*/true);
        assert(outVal, 'should return true');

        done();
    })
    it('gets false bool input value', function (done) {
        this.timeout(1000);

        var inputValue = 'false';
        process.env['INPUT_ABOOL'] = inputValue;
        im._loadData();

        var outVal = tl.getBoolInput('abool', /*required=*/true);
        assert(!outVal, 'should return false');

        done();
    })
    it('defaults to false bool input value', function (done) {
        this.timeout(1000);

        im._loadData();

        var outVal = tl.getBoolInput('no_such_env_var', /*required=*/ false);
        assert(!outVal, 'should default to false');

        done();
    })

    // getDelimitedInput tests
    it('gets delimited input values removes empty values', function (done) {
        this.timeout(1000);

        var inputValue = 'test  value'; // contains two spaces
        process.env['INPUT_DELIM'] = inputValue;
        im._loadData();

        var outVal = tl.getDelimitedInput('delim', ' ', /*required*/true);
        assert.equal(outVal.length, 2, 'should return array with two elements');
        assert.equal(outVal[0], 'test', 'should return correct element 1');
        assert.equal(outVal[1], 'value', 'should return correct element 2');

        done();
    })
    it('gets delimited input for a single value', function (done) {
        this.timeout(1000);

        var inputValue = 'testvalue';
        process.env['INPUT_DELIM'] = inputValue;
        im._loadData();

        var outVal = tl.getDelimitedInput('delim', ' ', /*required*/true);
        assert.equal(outVal.length, 1, 'should return array with one element');
        assert.equal(outVal[0], 'testvalue', 'should return correct element 1');

        done();
    })
    it('gets delimited input for an empty value', function (done) {
        this.timeout(1000);

        var inputValue = '';
        process.env['INPUT_DELIM'] = inputValue;
        im._loadData();

        var outVal = tl.getDelimitedInput('delim', ' ', /*required*/false);
        assert.equal(outVal.length, 0, 'should return array with zero elements');

        done();
    })
    it('gets delimited input with a Regexp', function (done) {
        this.timeout(1000);

        var inputValue = 'a,b\nc';
        process.env['INPUT_DELIM'] = inputValue;
        im._loadData();

        var outVal = tl.getDelimitedInput('delim', /[,\n]/, /*required*/false);
        assert.equal(outVal.length, 3, 'should return array with 3 elements');

        done();
    })

    // getPathInput tests
    it('gets path input value', function (done) {
        this.timeout(1000);

        var inputValue = 'test.txt'
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var path = tl.getPathInput('path1', /*required=*/true, /*check=*/false);
        assert(path, 'should return a path');
        assert.equal(path, inputValue, 'test path value');

        done();
    })
    it('throws if required path not supplied', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var worked: boolean = false;
        try {
            var path = tl.getPathInput(null, /*required=*/true, /*check=*/false);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'req path should have not have worked');

        done();
    })
    it('get invalid checked path throws', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var worked: boolean = false;
        try {
            var path = tl.getPathInput('some_missing_path', /*required=*/true, /*check=*/true);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'invalid checked path should have not have worked');

        done();
    })
    it('gets path invalid value not required', function (done) {
        this.timeout(1000);

        var errStream = testutil.createStringStream();
        tl.setErrStream(errStream);

        var path = tl.getPathInput('some_missing_path', /*required=*/false, /*check=*/false);
        assert(!path, 'should not return a path');

        var errMsg = errStream.getContents();
        assert.equal(errMsg, "", "no err")

        done();
    })
    it('gets path input value with space', function (done) {
        this.timeout(1000);

        var inputValue = 'file name.txt';
        var expectedValue = 'file name.txt';
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var path = tl.getPathInput('path1', /*required=*/true, /*check=*/false);
        assert(path, 'should return a path');
        assert.equal(path, expectedValue, 'returned ' + path + ', expected: ' + expectedValue);

        done();
    })
    it('gets path value with check and exist', function (done) {
        this.timeout(1000);

        var errStream = testutil.createStringStream();
        tl.setErrStream(errStream);

        var inputValue = __filename;
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var path = tl.getPathInput('path1', /*required=*/true, /*check=*/true);
        assert(path, 'should return a path');
        assert.equal(path, inputValue, 'test path value');

        var errMsg = errStream.getContents();
        assert(errMsg === "", "no err")

        done();
    })
    it('gets path value with check and not exist', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var inputValue = "someRandomFile.txt";
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var worked: boolean = false;
        try {
            var path = tl.getPathInput('path1', /*required=*/true, /*check=*/true);
            worked = true;
        }
        catch (err) {
            assert(err.message.indexOf("Not found") >= 0, "error should have said Not found");
        }
        assert(!worked, 'invalid checked path should have not have worked');

        done();
    })

    // getPathInputRequired tests
    it('gets path input required value', function (done) {
        this.timeout(1000);

        var inputValue = 'test.txt'
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var path = tl.getPathInputRequired('path1', /*check=*/false);
        assert(path, 'should return a path');
        assert.equal(path, inputValue, 'test path value');

        done();
    })
    it('throws if required path not supplied', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var worked: boolean = false;
        try {
            var path = tl.getPathInputRequired(null, /*check=*/false);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'req path should have not have worked');

        done();
    })
    it('get required path invalid checked throws', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var worked: boolean = false;
        try {
            var path = tl.getPathInputRequired('some_missing_path', /*check=*/true);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'invalid checked path should have not have worked');

        done();
    })
    it('gets path input required value with space', function (done) {
        this.timeout(1000);

        var inputValue = 'file name.txt';
        var expectedValue = 'file name.txt';
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var path = tl.getPathInputRequired('path1', /*check=*/false);
        assert(path, 'should return a path');
        assert.equal(path, expectedValue, 'returned ' + path + ', expected: ' + expectedValue);

        done();
    })
    it('gets path required value with check and exist', function (done) {
        this.timeout(1000);

        var errStream = testutil.createStringStream();
        tl.setErrStream(errStream);

        var inputValue = __filename;
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var path = tl.getPathInputRequired('path1', /*check=*/true);
        assert(path, 'should return a path');
        assert.equal(path, inputValue, 'test path value');

        var errMsg = errStream.getContents();
        assert(errMsg === "", "no err")

        done();
    })
    it('gets path required value with check and not exist', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var inputValue = "someRandomFile.txt";
        process.env['INPUT_PATH1'] = inputValue;
        im._loadData();

        var worked: boolean = false;
        try {
            var path = tl.getPathInputRequired('path1', /*check=*/true);
            worked = true;
        }
        catch (err) {
            assert(err.message.indexOf("Not found") >= 0, "error should have said Not found");
        }
        assert(!worked, 'invalid checked path should have not have worked');

        done();
    })

    // filePathSupplied tests
    it('filePathSupplied checks not supplied', function (done) {
        this.timeout(1000);

        var repoRoot = '/repo/root/dir';
        process.env['INPUT_PATH1'] = repoRoot;
        im._loadData();

        process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
        var supplied = tl.filePathSupplied('path1');
        assert(!supplied, 'path1 should not be supplied');
        done();
    })
    it('filePathSupplied checks supplied', function (done) {
        this.timeout(1000);

        var repoRoot = '/repo/root/dir';
        process.env['INPUT_PATH1'] = repoRoot + '/some/path';
        im._loadData();

        process.env['BUILD_SOURCESDIRECTORY'] = repoRoot;
        var supplied = tl.filePathSupplied('path1');
        assert(supplied, 'path1 should be supplied');
        done();
    })

    // resolve tests
    it('resolve', function (done) {
        var absolutePath = tl.resolve('/repo/root', '/repo/root/some/path');
        if (os.platform() !== 'win32') {
            assert(absolutePath === '/repo/root/some/path', 'absolute path not expected, got:' + absolutePath + ' expected: /repo/root/some/path');
        } else {
            var winDrive = path.parse(path.resolve('')).root;
            var expectedPath = winDrive.concat('repo\\root\\some\\path');
            assert.equal(absolutePath, expectedPath, 'absolute path not as expected, got: ' + absolutePath + ' expected: ' + expectedPath);
        }
        done();
    })

    // getTaskVariable tests
    it('gets a task variable', function (done) {
        this.timeout(1000);

        let originalAgentVersion = process.env['AGENT_VERSION'];
        try {
            process.env['AGENT_VERSION'] = '2.115.0';
            process.env['VSTS_TASKVARIABLE_TEST1'] = 'Task variable value 1';
            im._loadData();
            var varVal = tl.getTaskVariable('test1');
            assert.equal(varVal, 'Task variable value 1');
        }
        finally {
            process.env['AGENT_VERSION'] = originalAgentVersion;
        }

        done();
    })
    it('sets a task variable', function (done) {
        this.timeout(1000);

        let originalAgentVersion = process.env['AGENT_VERSION'];
        try {
            process.env['AGENT_VERSION'] = '2.115.0';
            tl.setTaskVariable('test2', 'Task variable value 2');
            let varVal: string = tl.getTaskVariable('test2');
            assert.equal(varVal, 'Task variable value 2');
        }
        finally {
            process.env['AGENT_VERSION'] = originalAgentVersion;
        }

        done();
    })

    // assertAgent tests
    it('assert agent does not fail when empty', function (done) {
        this.timeout(1000);

        let originalAgentVersion = process.env['AGENT_VERSION'];
        try {
            process.env['AGENT_VERSION'] = '';
            let failed = false;
            try {
                tl.assertAgent('2.115.0');
            }
            catch (err) {
                failed = true;
            }

            assert(!failed, 'assert should not have thrown');
        }
        finally {
            process.env['AGENT_VERSION'] = originalAgentVersion;
        }

        done();
    })
    it('assert agent fails when less than', function (done) {
        this.timeout(1000);

        let originalAgentVersion = process.env['AGENT_VERSION'];
        try {
            process.env['AGENT_VERSION'] = '2.114.0';
            let failed = false;
            try {
                tl.assertAgent('2.115.0');
            }
            catch (err) {
                failed = true;
            }

            assert(failed, 'assert should have thrown');
        }
        finally {
            process.env['AGENT_VERSION'] = originalAgentVersion;
        }

        done();
    })
    it('assert succeeds when greater or equal', function (done) {
        this.timeout(1000);

        let originalAgentVersion = process.env['AGENT_VERSION'];
        try {
            process.env['AGENT_VERSION'] = '2.115.0';
            tl.assertAgent('2.115.0');
            process.env['AGENT_VERSION'] = '2.116.0';
            tl.assertAgent('2.115.0');
        }
        finally {
            process.env['AGENT_VERSION'] = originalAgentVersion;
        }

        done();
    })

    // _loadData tests
    it('_loadData does not run twice', function (done) {
        this.timeout(5000);

        // intialize an input (stored in vault)
        process.env['INPUT_SOMEINPUT'] = 'some input value';
        im._loadData();
        assert.equal(tl.getInput('SomeInput'), 'some input value');

        // copy azure-pipelines-task-lib to a different dir and load it from
        // there so it will be forced to load again
        let testDir = path.join(testutil.getTestTemp(), '_loadData-not-called-twice');
        tl.mkdirP(testDir);
        tl.cp(path.join(__dirname, '..', '_build'), testDir, '-R');
        require(path.join(testDir, '_build', 'task'));

        assert.equal(tl.getInput('SomeInput'), 'some input value');
        done();
    })

    describe('Feature flags tests', () => {

        ([
            ["true", true],
            ["TRUE", true],
            ["TruE", true],
            ["false", false],
            ["treu", false],
            ["fasle", false],
            ["On", false],
            ["", false],
            [undefined, false]
        ] as [string, boolean][])
            .forEach(
                (
                    [
                        input,
                        expectedResult
                    ]
                ) => {
                    it(`Should return ${expectedResult} if feature flag env is ${input}`, () => {
                        const ffName = "SOME_TEST_FF"
                        process.env[ffName] = input

                        const ffValue = tl.getBoolFeatureFlag(ffName, false);

                        assert.equal(ffValue, expectedResult);
                    })
                }
            );

        it(`Should return default value if feature flag env is empty`, () => {
            const ffName = "SOME_TEST_FF"
            process.env[ffName] = ""

            const ffValue = tl.getBoolFeatureFlag(ffName, true);

            assert.equal(ffValue, true);
        })

        it(`Should return default value if feature flag env is not specified`, () => {
            const ffName = "SOME_TEST_FF"
            delete process.env[ffName];

            const ffValue = tl.getBoolFeatureFlag(ffName, true);

            assert.equal(ffValue, true);
        })
    });

    describe('Pipeline features tests', () => {
        it(`Should return if no feature variable present.`, () => {
            const featureName = "TestFeature"
            delete process.env[im._getVariableKey(`DistributedTask.Tasks.${featureName}`)];

            const ffValue = tl.getPipelineFeature(featureName);

            assert.deepStrictEqual(ffValue, false);
        })

        const testInputs = ([
            ["true", true],
            ["TRUE", true],
            ["TruE", true],
            ["false", false],
            ["treu", false],
            ["fasle", false],
            ["On", false],
            ["", false],
            [undefined, false]
        ] as [string, boolean][])
        for (const [input, expected] of testInputs) {
            it(`Should return '${expected}' if feature is '${input}'`, () => {
                const featureVariable = "DISTRIBUTEDTASK_TASKS_TESTFEATURE";
                const featureName = "TestFeature";
                process.env[featureVariable] = input;

                const result = tl.getPipelineFeature(featureName);

                assert.deepStrictEqual(result, expected);
            })
        }
    })
});
