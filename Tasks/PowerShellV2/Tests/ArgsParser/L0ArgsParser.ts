import assert = require('assert');
import { parsePowerShellArguments } from '../../ArgsParser';

export const ArgsParserTests = () => {
    it('Should parse a simple argument string', () => {
        const argsLine = 'hello world';
        const expectedArgs = ['hello', 'world'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    });

    it('Should handle quoted arguments', () => {
        const argsLine = '1 "2    3"';
        const expectedArgs = ['1', '2    3'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    });

    it('Should handle quoted arguments with 2 spaces inside', () => {
        const argsLine = 'hello "big  world"';
        const expectedArgs = ['hello', 'big  world'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    });

    it('Should ignore spaces between non-quoted args', () => {
        const argsLine = 'hello          world';
        const expectedArgs = ['hello', 'world'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Should handle escaped chars', () => {
        const argsLine = 'hello "big `"world`""';
        const expectedArgs = ['hello', 'big "world"'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    });

    it('Should handle string with single quotes', () => {
        const argsLine = `hello 'world'`
        const expectedArgs = ['hello', 'world']

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    });

    it('Should handle argument in single quotes properly', () => {
        const argsLine = `hello 'big world'`
        const expectedArgs = ['hello', 'big world']

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    });

    it('Should handle escaped backslashes', () => {
        const argsLine = '1 "2 `\\`\\3"';
        const expectedArgs = ['1', '2 \\\\3'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    });

    // it works this way in powershell
    it('Should handle args with backslash', () => {
        const argsLine = 'one two\\arg     three';
        const expectedArgs = ['one', 'two\\arg', 'three'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Escaped escape character passed as a separate argument should present', () => {
        const argsLine = '`` 2';
        const expectedArgs = ['`', '2'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Single escape character passed as a separate argument should be ignored', () => {
        const argsLine = '` 2';
        const expectedArgs = ['2'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Escaped escape character should present in args when inside a double quotes', () => {
        const argsLine = '"`` 2"';
        const expectedArgs = ['` 2'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Should handle multiple quote types properly', () => {
        const argsLine = `1 '2 "nested"'`
        const expectedArgs = ['1', `2 "nested"`]

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Should handle multiple quote types properly 2', () => {
        const argsLine = `1 "2 'nested'"`
        const expectedArgs = ['1', `2 'nested'`]

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Single escape inside quoted argument should make no sense', () => {
        const argsLine = `"hello \`'world'"`;
        const expectedArgs = [`hello 'world'`];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Single escape character should present in args when inside a double quotes', () => {
        const argsLine = '"` 2"';
        const expectedArgs = [' 2'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Escape character should present in args when inside a single quotes', () => {
        const argsLine = '\'` 2\'';
        const expectedArgs = ['` 2'];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    it('Separate quotes which are inside other should be present in result string', () => {
        const argsLine = `"hello ' big  world '"`;
        const expectedArgs = [`hello ' big  world '`];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    //
    // Env variables tests
    //
    it('Should get env variable from argument', () => {
        const argsLine = '$env:VAR1';
        const expectedArgs = ['value1'];
        process.env['VAR1'] = 'value1'

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should get env variables from argument', () => {
        const argsLine = '$env:VAR1   $env:VAR2';
        const expectedArgs = ['value1', 'value2'];
        process.env['VAR1'] = 'value1'
        process.env['VAR2'] = 'value2'

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should leave empty if no variable specified', () => {
        const argsLine = '$env:VAR555';
        const expectedArgs = [];

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should leave var name if escaped', () => {
        const argsLine = '`$env:VAR1';
        const expectedArgs = ['$env:VAR1'];
        process.env['VAR1'] = 'value1'

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should process var name if escaped escape', () => {
        const argsLine = '``$env:VAR1';
        const expectedArgs = ['`value1'];
        process.env['VAR1'] = 'value1'

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should leave empty if escaped', () => {
        const argsLine = '$`env:VAR1';
        const expectedArgs = ['$env:VAR1'];
        process.env['VAR1'] = 'value1'

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should ignore variables inside expansion syntax', () => {
        const argsLine = '$(env:VAR1)';
        const expectedArgs = ['$(env:VAR1)'];
        process.env['VAR1'] = 'value1'

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })
    it('Should break envs processing in case of unmatched expansion', () => {
        const argsLine = '$(env:VAR1 $env:VAR1';
        const expectedArgs = ['$(env:VAR1', '$env:VAR1'];
        process.env['VAR1'] = 'value1'

        const [actualArgs] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(actualArgs, expectedArgs);
    })

    // We do not support braced env syntax since for now.
    const bracedSyntaxInputs = [
        ['${env:VAR1}', ['${env:VAR1}']],
        ['${EnV:Var1}', ['${EnV:Var1}']]
    ]
    bracedSyntaxInputs.forEach(([inputArgs, expectedArgs], i) => {
        it(`Should not handle env vars with braced syntax #${i + 1}`, () => {
            process.env['VAR1'] = 'value1'

            const [actualArgs] = parsePowerShellArguments(inputArgs as string);

            assert.deepStrictEqual(actualArgs, expectedArgs);
        })
    })
}
