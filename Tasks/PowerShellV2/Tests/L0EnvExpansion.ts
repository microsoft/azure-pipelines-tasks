import assert = require('assert');
import { expandPowerShellEnvVariables } from '../helpers';

export const testEnvExpansion = () => {
    it('Should expand env variable in string', () => {
        const argsLine = '$env:VAR1 2';
        const expectedArgs = 'value1 2';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should expand 2 close env variables', () => {
        const argsLine = '$env:VAR1 $env:VAR2';
        const expectedArgs = 'value1 value2';
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should ignore nested variables', () => {
        const argsLine = '$env:VAR1 $env:VAR2';
        const expectedArgs = '$env:NESTED 2';
        process.env['VAR1'] = '$env:NESTED'
        process.env['VAR2'] = '2'
        process.env['NESTED'] = 'nested'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Backtick before env var', () => {
        const argsLine = '`$env:VAR1';
        const expectedArgs = '$env:VAR1';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Backtick inside env var', () => {
        const argsLine = '$env:V`AR1';
        const expectedArgs = 'AR1';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the single quotes - it should be ignored`, () => {
        const argsLine = `$env:VAR1 '$env:VAR2'`;
        const expectedArgs = `value1 '$env:VAR2'`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the single quotes - it should be ignored 2`, () => {
        const argsLine = `$env:VAR1 ' _ $env:VAR2 _ '`;
        const expectedArgs = `value1 ' _ $env:VAR2 _ '`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the single quotes - it should be ignored 3`, () => {
        const argsLine = `$env:VAR1 ' _ $env:VAR2 _ ''$env:VAR3'`;
        const expectedArgs = `value1 ' _ $env:VAR2 _ ''$env:VAR3'`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'
        process.env['VAR3'] = 'value3'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the double quotes - it should be expanded`, () => {
        const argsLine = `$env:VAR1 "$env:VAR2"`;
        const expectedArgs = `value1 "value2"`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`Close quotes`, () => {
        const argsLine = `''$env:VAR1 $env:VAR2`;
        const expectedArgs = `''value1 value2`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Should handle if escaping character escaped before env', () => {
        const argsLine = '``$env:VAR1';
        const expectedArgs = '``value1';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Should process env var also with mismatched cases of prefix', () => {
        const argsLine = '$eNv:VAR1';
        const expectedArgs = 'value1';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Should process close env vars', () => {
        const argsLine = '$env:VAR1$env:VAR2';
        const expectedArgs = 'value1value2';
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = expandPowerShellEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
}
