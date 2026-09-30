import assert = require('assert');
import { expandPowerShellEnvVariables } from '../helpers';

export const testEnvExpansion = () => {
    const testSuites: [string, string, string[], string][] = [
        [
            "Handles empty line",
            "", [], ""
        ],
        [
            "Expanding known env variables",
            "$env:VAR1 2", ["VAR1=1"], "1 2"
        ],
        [
            'Expanding env variables with brace syntax',
            '${env:VAR1} 2', ['VAR1=1'], '1 2'
        ],
        [
            'Expanding multiple env variables',
            '1 $env:VAR1 $env:VAR2', ['VAR1=val1', 'VAR2=val2'], '1 val1 val2'
        ],
        [
            'Expanding multiple env variables 2',
            '$env:VAR1 $env:VAR2', ['VAR1=1', 'VAR2=2'], '1 2'
        ],
        [
            'Expanding multiple close env variables',
            '$env:VAR1 $env:VAR2$env:VAR3', ['VAR1=1', 'VAR2=2', 'VAR3=3'], '1 23'
        ],
        [
            'Expanding multiple close env variables 2',
            '$env:VAR1 ${env:VAR2}_$env:VAR3', ['VAR1=1', 'VAR2=2', 'VAR3=3'], '1 2_3'
        ],
        [
            'Expanding multiple close env variables 3',
            '${env:VAR1}$env:VAR2', ['VAR1=1', 'VAR2=2',], '12'
        ],
        [
            'Expanding multiple close env variables 3',
            '$env:VAR1$env:VAR2$env:VAR3', ['VAR1=1', 'VAR2=2', 'VAR3=3'], '123'
        ],
        [
            'Not expanding nested env variables',
            '$env:VAR1 $env:VAR2', ['VAR1=$env:NESTED', 'VAR2=2', 'NESTED=nested'], '$env:NESTED 2'
        ],
        [
            'Not expanding if backtick before env var',
            '`$env:VAR1', ['VAR1=val1'], '$env:VAR1'
        ],
        [
            'Not expanding if backtick at start of env var',
            '$`env:VAR1', ['VAR1=val1'], '$`env:VAR1'
        ],
        [
            'Not expanding if backtick inside env var',
            '$env:VA`R1', ['VAR1=val1'], '$env:VA`R1'
        ],
        [
            'If variable inside single quotes, it should be ignored',
            '$env:VAR1 \'$env:VAR2\'', ['VAR1=val1', 'VAR2=val2'], 'val1 \'$env:VAR2\''
        ],
        [
            'If variable inside single quotes, it should be ignored 2',
            '$env:VAR1 \' _ $env:VAR2 _ \'', ['VAR1=val1', 'VAR2=val2'], 'val1 \' _ $env:VAR2 _ \''
        ],
        [
            'If variable inside single quotes, it should be ignored 3',
            '$env:VAR1 \' _ $env:VAR2 _ \'\'$env:VAR3\'', ['VAR1=val1', 'VAR2=val2', 'VAR3=val3'], 'val1 \' _ $env:VAR2 _ \'\'$env:VAR3\''
        ],
        [
            'If variable inside double quotes, it should be expanded',
            '$env:VAR1 "$env:VAR2"', ['VAR1=val1', 'VAR2=val2'], 'val1 "val2"'
        ],
        [
            'If quotes closed, variable should be expanded',
            '\'\'$env:VAR1', ['VAR1=val1'], '\'\'val1'
        ],
        [
            'If quotes closed, variable should be expanded 2',
            '\'\'$env:VAR1\'\'', ['VAR1=val1'], '\'\'val1\'\''
        ],
        [
            'If variable is does not exists, it should not be expanded',
            '$env:VAR1 2', ['VAR1='], '$env:VAR1 2'
        ],
        [
            'If variable syntax is incorrect, it should leave it as is',
            '$venv:VAR1 ${_env:VAR2}', ['VAR1=val1', 'VAR2=val2'], '$venv:VAR1 ${_env:VAR2}'
        ],
        [
            'If closing brace is not present, it should leave it as is',
            '$env:VAR1 ${env:VAR2', ['VAR1=val1', 'VAR2=val2'], 'val1 ${env:VAR2',
        ],
        [
            'If closing brace is not present, it should leave it as is 2',
            '${env:VAR1 ${env:VAR2}', ['VAR1=val1', 'VAR2=val2'], '${env:VAR1 ${env:VAR2}',
        ]
    ]

    for (const [testName, input, variables, expected] of testSuites) {
        it(testName, () => {
            for (const variable of variables) {
                const [name, value] = variable.split('=');
                if (value) {
                    process.env[name] = value;
                }
                else {
                    delete process.env[name];
                }
            }

            const [actual] = expandPowerShellEnvVariables(input);

            assert.deepStrictEqual(actual, expected);
        });
    }
}
