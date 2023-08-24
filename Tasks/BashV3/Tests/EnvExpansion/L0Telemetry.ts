import assert = require('assert');
import { expandBashEnvVariables } from '../../helpers';

export const EnvProcessingTelemetryTests = () => {
    // maybe we should treat that differently
    it('Found prefixes test', () => {
        const argsLine = '$ ${} $';
        const expectedTelemetry = { foundPrefixes: 3 };

        const [_, resultTelemetry] = expandBashEnvVariables(argsLine);

        assert.deepStrictEqual(resultTelemetry.foundPrefixes, expectedTelemetry.foundPrefixes);
    })
    it('Not closed brace syntax', () => {
        const argsLine = '${';
        const expectedTelemetry = { notClosedBraceSyntaxPosition: 1 };

        const [_, resultTelemetry] = expandBashEnvVariables(argsLine);

        assert.deepStrictEqual(resultTelemetry.notClosedBraceSyntaxPosition, expectedTelemetry.notClosedBraceSyntaxPosition);
    })
    it('Not closed brace syntax 2', () => {
        const argsLine = "'${' ${";
        const expectedTelemetry = { notClosedBraceSyntaxPosition: 6 };

        const [_, resultTelemetry] = expandBashEnvVariables(argsLine);

        assert.deepStrictEqual(resultTelemetry.notClosedBraceSyntaxPosition, expectedTelemetry.notClosedBraceSyntaxPosition);
    })
    it('Not closed quotes', () => {
        const argsLine = "' $A";
        const expectedTelemetry = { unmatchedQuotes: 1 };

        const [_, resultTelemetry] = expandBashEnvVariables(argsLine);

        assert.deepStrictEqual(resultTelemetry.unmatchedQuotes, expectedTelemetry.unmatchedQuotes);
    })
    it('Quotted blocks count', () => {
        // We're ignores quote blocks where no any env variables
        const argsLine = "'$VAR1' '$VAR2' '3'";
        const expectedTelemetry = { quottedBlocks: 2 };

        const [_, resultTelemetry] = expandBashEnvVariables(argsLine);

        assert.deepStrictEqual(resultTelemetry.quottedBlocks, expectedTelemetry.quottedBlocks);
    })
    it('Catches indirect expansion', () => {
        const argsLine = "${!VAR1} ${!VAR2}";
        const expectedTelemetry = { indirectExpansion: 2 };

        const [_, resultTelemetry] = expandBashEnvVariables(argsLine);

        assert.deepStrictEqual(resultTelemetry.indirectExpansionTries, expectedTelemetry.indirectExpansion);
    })
    it('Skip indirect expansion inside quotes', () => {
        const argsLine = "'${!VAR1}'";
        const expectedTelemetry = { indirectExpansion: 0 };

        const [_, resultTelemetry] = expandBashEnvVariables(argsLine);

        assert.deepStrictEqual(resultTelemetry.indirectExpansionTries, expectedTelemetry.indirectExpansion);
    })
}
