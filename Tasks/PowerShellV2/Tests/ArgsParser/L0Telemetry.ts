import assert = require('assert');
import { parsePowerShellArguments } from '../../ArgsParser';

export const ArgsParserTelemetryTests = () => {
    it('Found prefixes test', () => {
        const argsLine = '$env: $env:$env:';
        const expectedTelemetry = { foundPrefixes: 3 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.foundPrefixes, expectedTelemetry.foundPrefixes);
    })
    it('Found prefixes test', () => {
        const argsLine = '$env: $env:$env:';
        const expectedTelemetry = { foundPrefixes: 3 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.foundPrefixes, expectedTelemetry.foundPrefixes);
    })
    it('Checks if last arg character is escaping backtick', () => {
        const argsLine = '1` 2`';
        const expectedTelemetry = { lastCharMeaningfulBacktick: 2 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.lastCharMeaningfulBacktick, expectedTelemetry.lastCharMeaningfulBacktick);
    })
    it('Checks nested quotes', () => {
        const argsLine = `'"1" "2"'`;
        const expectedTelemetry = { nestedQuotes: 4 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.nestedQuotes, expectedTelemetry.nestedQuotes);
    })
    it('Checks closed quote pairs telemetry', () => {
        const argsLine = `'1' "2"`;
        const expectedTelemetry = { closedQuotePairs: 2 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.closedQuotePairs, expectedTelemetry.closedQuotePairs);
    })
    it('Checks escaped quotes telemetry', () => {
        const argsLine = '`" `\'';
        const expectedTelemetry = { escapedQuotes: 2 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.escapedQuotes, expectedTelemetry.escapedQuotes);
    })
    it('Checks count of escaped backticks', () => {
        const argsLine = '``1 ``2';
        const expectedTelemetry = { escapedBackticks: 2 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.escapedBackticks, expectedTelemetry.escapedBackticks);
    })
    it('Checks amount of special characters', () => {
        const argsLine = `'$100'; "@fakelist" & iex whoami`;
        // we're ignoring what's inside single quotes
        const expectedTelemetry = { specialCharacters: 3 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.specialCharacters, expectedTelemetry.specialCharacters);
    })
    it('Determines disclosed quotes pair 1', () => {
        const argsLine = `'1' "2`;
        // we're ignoring what's inside single quotes
        const expectedTelemetry = { unmatchedQuotes: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unmatchedQuotes, expectedTelemetry.unmatchedQuotes);
    })
    it('Determines disclosed quotes pair 2', () => {
        const argsLine = `'1' "2 ' " '`;
        // we're ignoring what's inside single quotes
        const expectedTelemetry = { unmatchedQuotes: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unmatchedQuotes, expectedTelemetry.unmatchedQuotes);
    })

    it('Should process if single quotes not closed, but with no env inside', () => {
        const argsLine = `'1`;
        const expectedTelemetry = { unmatchedQuotes: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unmatchedQuotes, expectedTelemetry.unmatchedQuotes, 'unmatchedQuotes should be 1');
    })

    it('Should process if single quotes not closed', () => {
        const argsLine = `'$env:VAR1`;
        process.env['VAR1'] = 'value1'
        const expectedTelemetry = { unmatchedQuotes: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unmatchedQuotes, expectedTelemetry.unmatchedQuotes, 'unmatchedQuotes should be 1');
    })

    it('Should determine unbalanced quotes', () => {
        const argsLine = `'1 "2'`;

        const expectedTelemetry = { unbalancedQuotes: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unbalancedQuotes, expectedTelemetry.unbalancedQuotes, 'unbalancedQuotes should be 1');
    })

    it('Should determine unbalanced quotes 2', () => {
        const argsLine = `"1 '2"`;

        const expectedTelemetry = { unbalancedQuotes: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unbalancedQuotes, expectedTelemetry.unbalancedQuotes, 'unbalancedQuotes should be 1');
    })

    it('Should determine unbalanced quotes 3', () => {
        const argsLine = `"1 '2" '3 "' "4''5"`;

        const expectedTelemetry = { unbalancedQuotes: 2 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unbalancedQuotes, expectedTelemetry.unbalancedQuotes, 'unbalancedQuotes should be 2');
    })
    it('Should write telemetry about expansion syntax', () => {
        const argsLine = `$(env:VAR1)`;

        const expectedTelemetry = { expansionSyntax: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.expansionSyntax, expectedTelemetry.expansionSyntax);
    })
    it('Should write telemetry about unmatched expansion', () => {
        const argsLine = `$(env:VAR1 $env:VAR1`;

        const expectedTelemetry = { unmatchedExpansionSyntax: 1 };

        const [_, resultTelemetry] = parsePowerShellArguments(argsLine);

        assert.deepStrictEqual(resultTelemetry.unmatchedExpansionSyntax, expectedTelemetry.unmatchedExpansionSyntax);
    })

    const bracedSyntaxInputs = [
        '${env:VAR1}',
        '${EnV:Var1}'
    ]
    bracedSyntaxInputs.forEach((inputArgs, i) => {
        it(`Should indicate about env vars with braced syntax #${i + 1}`, () => {
            const expectedTelemetry = { bracedEnvSyntax: 1 };

            const [_, resultTelemetry] = parsePowerShellArguments(inputArgs);

            assert.deepStrictEqual(resultTelemetry.bracedEnvSyntax, expectedTelemetry.bracedEnvSyntax);
        })
    })
}
