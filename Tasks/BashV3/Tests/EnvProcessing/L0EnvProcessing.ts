import assert = require('assert');
import { processBashEnvVariables } from '../../bashEnvProcessor';

export const BashEnvProcessingTests = () => {
    it('Expanding known env variables', () => {
        const argsLine = '$VAR1 2';
        const expectedArgs = 'value1 2';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Expanding env variables with brace syntax', () => {
        const argsLine = '${VAR1} 2';
        const expectedArgs = 'value1 2';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Expanding multiple env variables', () => {
        const argsLine = '1 ${VAR1} $VAR2';
        const expectedArgs = '1 value1 value2';
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Expanding multiple close env variables', () => {
        const argsLine = '$VAR1 ${VAR2}$VAR3';
        const expectedArgs = 'value1 value2value3';
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'
        process.env['VAR3'] = 'value3'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Expanding multiple close env variables', () => {
        const argsLine = '$VAR1 ${VAR2}_$VAR3';
        const expectedArgs = 'value1 value2_value3';
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'
        process.env['VAR3'] = 'value3'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Expanding multiple close env variables 3', () => {
        const argsLine = '${VAR1}${VAR2}$VAR3';
        const expectedArgs = '123';
        process.env['VAR1'] = '1'
        process.env['VAR2'] = '2'
        process.env['VAR3'] = '3'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Expanding multiple env variables 2', () => {
        const argsLine = '$VAR1 $VAR2';
        const expectedArgs = '1 2';
        process.env['VAR1'] = '1'
        process.env['VAR2'] = '2'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Not expanding nested env variables', () => {
        const argsLine = '$VAR1 $VAR2';
        const expectedArgs = '$NESTED 2';
        process.env['VAR1'] = '$NESTED'
        process.env['VAR2'] = '2'
        process.env['NESTED'] = 'nested'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Backslash before env var', () => {
        const argsLine = '\\$VAR1';
        const expectedArgs = '$VAR1';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Backslash at start of env var', () => {
        const argsLine = '$\\VAR1';
        const expectedArgs = '$VAR1';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Backslash inside env var', () => {
        const argsLine = '$V\\AR1';
        const expectedArgs = 'AR1';
        process.env['VAR1'] = 'value1'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the single quotes - it should be ignored`, () => {
        const argsLine = `$VAR1 '$VAR2'`;
        const expectedArgs = `value1 '$VAR2'`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the single quotes - it should be ignored 2`, () => {
        const argsLine = `$VAR1 ' _ $VAR2 _ '`;
        const expectedArgs = `value1 ' _ $VAR2 _ '`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the single quotes - it should be ignored 3`, () => {
        const argsLine = `$VAR1 ' _ $VAR2 _ ''$VAR3'`;
        const expectedArgs = `value1 ' _ $VAR2 _ ''$VAR3'`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'
        process.env['VAR3'] = 'value3'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`If it's inside the double quotes - it should be expanded`, () => {
        const argsLine = `$VAR1 "$VAR2"`;
        const expectedArgs = `value1 "value2"`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it(`Close quotes`, () => {
        const argsLine = `''$VAR1 $VAR2`;
        const expectedArgs = `''value1 value2`;
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = processBashEnvVariables(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
}
