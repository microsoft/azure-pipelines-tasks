// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as assert from 'assert';
import * as testutil from './testutil';
import * as libMocker from '../_build/lib-mocker'

describe('Internal Mock tool Tests', function () {
    const consoleMocker = new testutil.ConsoleMocker();
    
    function resetMockerToInitialState() {
        consoleMocker.restore();
        libMocker.deregisterAll();
        libMocker.disable();
    }

    beforeEach(function (done) {
        consoleMocker.mock();
        done();
    });

    afterEach(function () {
        resetMockerToInitialState();
    });

    it('[warnOnReplace: Passed true via config]. Should write warning when previously registered mocks are replaced.', (done) => {
        libMocker.enable({ warnOnReplace: true, warnOnUnregistered: false });
        const fakeModule = require('./fakeModules/fakemodule1');
        
        libMocker.registerMock('fakemodule1', fakeModule);
        libMocker.registerMock('fakemodule1', fakeModule);

        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 1);
        assert.equal(errors.length, 0);
        assert.equal(warnings[0], 'WARNING: Replacing existing mock for module: fakemodule1');

        done();
    });

    it('[warnOnReplace: Passed true via method]. Should write warning when previously registered mocks are replaced.', (done) => {
        libMocker.enable({ warnOnUnregistered: false });
        libMocker.warnOnReplace(true);
        const fakeModule = require('./fakeModules/fakemodule1');
        
        libMocker.registerMock('fakemodule1', fakeModule);
        libMocker.registerMock('fakemodule1', fakeModule);

        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 1);
        assert.equal(errors.length, 0);
        assert.equal(warnings[0], 'WARNING: Replacing existing mock for module: fakemodule1');

        done();
    });

    it('[warnOnReplace: Passed false via config]. Should not write warning when previously registered mocks are replaced.', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: false });
        const fakeModule = require('./fakeModules/fakemodule1');
        
        libMocker.registerMock('fakemodule1', fakeModule);
        libMocker.registerMock('fakemodule1', fakeModule);

        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 0);
        assert.equal(errors.length, 0);

        libMocker.disable();
        done();
    });

    it('[warnOnReplace: Passed false via method]. Should not write warning when previously registered mocks are replaced.', (done) => {
        libMocker.enable({ warnOnUnregistered: false });
        libMocker.warnOnReplace(false);
        const fakeModule = require('./fakeModules/fakemodule1');
        
        libMocker.registerMock('fakemodule1', fakeModule);
        libMocker.registerMock('fakemodule1', fakeModule);

        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 0);
        assert.equal(errors.length, 0);

        done();
    });

    it('[warnOnUnregistered: Passed true via config]. Should write warning when call unregister function.', (done) => {
        libMocker.enable({ warnOnReplace: false,  warnOnUnregistered: true });

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 1);
        assert.equal(errors.length, 0);
        assert.equal(warnings[0], 'WARNING: loading non-allowed module: ./fakeModules/fakemodule1');

        done();
    });

    it('[warnOnUnregistered: Passed true via method]. Should write warning when call unregister function.', (done) => {
        libMocker.enable({ warnOnReplace: false });
        libMocker.warnOnUnregistered(true);

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 1);
        assert.equal(errors.length, 0);
        assert.equal(warnings[0], 'WARNING: loading non-allowed module: ./fakeModules/fakemodule1');

        done();
    });

    it('[warnOnUnregistered: Passed false via config]. Should not write warning when call unregister function.', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: false });

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 0);
        assert.equal(errors.length, 0);

        done();
    });

    it('[warnOnUnregistered: Passed false via method]. Should not write warning when call unregister function.', (done) => {
        libMocker.enable({ warnOnReplace: false });
        libMocker.warnOnUnregistered(false);

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 0);
        assert.equal(errors.length, 0);

        done();
    });

    it('[warnOnUnregistered: register allowable]. Should not write warning when call register function.', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: true });
        libMocker.registerAllowable('./fakeModules/fakemodule1');

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 0);
        assert.equal(errors.length, 0);

        done();
    });

    it('[warnOnUnregistered: register allowables]. Should not write warning when call register function.', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: true });
        libMocker.registerAllowables(['./fakeModules/fakemodule1']);

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModule.otherFuncLibrary(), 'otherFuncLibrary');
        
        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 0);
        assert.equal(errors.length, 0);

        done();
    });

    it('[registerMock] Should register mock.', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: false });
        const expepected = {
            someMockedFunc: 'someMockedFunc',
            otherMockedFunc: 'otherMockedFunc',
        }

        libMocker.registerMock('./fakeModules/fakemodule1', {
            testFuncLibrary: () => expepected.someMockedFunc,
            otherFuncLibrary: () => expepected.otherMockedFunc,
        });

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), expepected.someMockedFunc);
        assert.equal(fakeModule.otherFuncLibrary(), expepected.otherMockedFunc);
        
        const warnings = consoleMocker.getWarns();
        assert.equal(warnings.length, 0);

        done();
    });

    it('[registerMock] Should return not registered function correctly.', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: false });
        const expepected = {
            someMockedFunc: 'someMockedFunc',
            otherMockedFunc: 'otherMockedFunc',
        }

        libMocker.registerMock('./fakeModules/fakemodule1', {
            testFuncLibrary: () => expepected.someMockedFunc,
            otherFuncLibrary: () => expepected.otherMockedFunc,
        });

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), expepected.someMockedFunc);
        assert.equal(fakeModule.otherFuncLibrary(), expepected.otherMockedFunc);

        const fakeModule2 = require('./fakeModules/fakemodule2');
        assert.equal(fakeModule2.testFuncLibrary2(), 'testFuncLibrary2');
        assert.equal(fakeModule2.otherFuncLibrary2(), 'otherFuncLibrary2');
        
        const warnings = consoleMocker.getWarns();
        assert.equal(warnings.length, 0);

        done();
    });

    it('[deregisterMock] Should deregister mock', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: false });
        const expepected = {
            someMockedFunc: 'someMockedFunc',
            otherMockedFunc: 'otherMockedFunc',
        }

        libMocker.registerMock('./fakeModules/fakemodule1', {
            testFuncLibrary: () => expepected.someMockedFunc,
            otherFuncLibrary: () => expepected.otherMockedFunc,
        });

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), expepected.someMockedFunc);
        assert.equal(fakeModule.otherFuncLibrary(), expepected.otherMockedFunc);
        
        libMocker.deregisterMock('./fakeModules/fakemodule1');
        const fakeModuleReRequired = require('./fakeModules/fakemodule1');
        assert.equal(fakeModuleReRequired.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModuleReRequired.otherFuncLibrary(), 'otherFuncLibrary');
        

        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 0);
        assert.equal(errors.length, 0);

        done();
    });

    it('[deregisterAll] Should deregister all mocks', (done) => {
        libMocker.enable({ warnOnReplace: false, warnOnUnregistered: true });
        const expepected = {
            someMockedFunc: 'someMockedFunc',
            otherMockedFunc: 'otherMockedFunc',
        }

        libMocker.registerMock('./fakeModules/fakemodule1', {
            testFuncLibrary: () => expepected.someMockedFunc,
            otherFuncLibrary: () => expepected.otherMockedFunc,
        });

        const fakeModule = require('./fakeModules/fakemodule1');
        assert.equal(fakeModule.testFuncLibrary(), expepected.someMockedFunc);
        assert.equal(fakeModule.otherFuncLibrary(), expepected.otherMockedFunc);
        
        libMocker.deregisterAll();
        const fakeModuleReRequired = require('./fakeModules/fakemodule1');
        assert.equal(fakeModuleReRequired.testFuncLibrary(), 'testFuncLibrary');
        assert.equal(fakeModuleReRequired.otherFuncLibrary(), 'otherFuncLibrary');
        

        const warnings = consoleMocker.getWarns();
        const errors = consoleMocker.getErrors();
        assert.equal(warnings.length, 1);
        assert.equal(errors.length, 0);

        done();
    });
});