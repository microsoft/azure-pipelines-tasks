import assert = require('assert');
import { expandBashEnvVariables } from '../../helpers';

export const BashEnvProcessingTests = () => {
    const testSuites: [string, string, string[], string][] = [
        [
            'Handles empty line',
            '', [], ''
        ],
        [
            'Expanding known env variables',
            '$VAR1 2', ['VAR1=value1'], 'value1 2'
        ],
        [
            'Expanding env variables with brace syntax',
            '${VAR1} 2', ['VAR1=value1'], 'value1 2'
        ],
        [
            'Expanding multiple env variables',
            '1 ${VAR1} $VAR2', ['VAR1=value1', 'VAR2=value2'], '1 value1 value2'
        ],
        [
            'Expanding multiple close env variables',
            '$VAR1 ${VAR2}$VAR3', ['VAR1=value1', 'VAR2=value2', 'VAR3=value3'], 'value1 value2value3'
        ],
        [
            'Expanding multiple close env variables',
            '$VAR1 ${VAR2}_$VAR3', ['VAR1=value1', 'VAR2=value2', 'VAR3=value3'], 'value1 value2_value3'
        ],
        [
            'Expanding multiple close env variables 3',
            '${VAR1}${VAR2}$VAR3', ['VAR1=1', 'VAR2=2', 'VAR3=3'], '123'
        ],
        [
            'Expanding multiple env variables 2',
            '$VAR1 $VAR2', ['VAR1=1', 'VAR2=2'], '1 2'
        ],
        [
            'Not expanding nested env variables',
            '$VAR1 $VAR2', ['VAR1=$NESTED', 'VAR2=2', 'NESTED=nested'], '$NESTED 2'
        ],
        [
            'Backslash before env var',
            '\\$VAR1', ['VAR1=value1'], '$VAR1'
        ],
        [
            'Backslash at start of env var',
            '$\\VAR1', ['VAR1=value1'], '$\\VAR1'
        ],
        [
            'Backslash inside env var - leave as is',
            '$V\\AR1', ['VAR1=value1'], '$V\\AR1'
        ],
        [
            `If it's inside the single quotes - it should be ignored`,
            `$VAR1 '$VAR2'`, ['VAR1=value1', 'VAR2=value2'], `value1 '$VAR2'`
        ],
        [
            `If it's inside the single quotes - it should be ignored 2`,
            `$VAR1 ' _ $VAR2 _ '`, ['VAR1=value1', 'VAR2=value2'], `value1 ' _ $VAR2 _ '`
        ],
        [
            `If it's inside the single quotes - it should be ignored 3`,
            `$VAR1 ' _ $VAR2 _ ''$VAR3'`, ['VAR1=value1', 'VAR2=value2', 'VAR3=value3'], `value1 ' _ $VAR2 _ ''$VAR3'`
        ],
        [
            `If it's inside the double quotes - it should be expanded`,
            `$VAR1 "$VAR2"`, ['VAR1=value1', 'VAR2=value2'], `value1 "value2"`
        ],
        [
            `Close quotes`,
            `''$VAR1 $VAR2`, ['VAR1=value1', 'VAR2=value2'], `''value1 value2`
        ],
        [
            'Skips variables with indirect expansion',
            '${VAR1} ${!VAR2} "${!VAR3}"', ['VAR1=value1', 'VAR2=value2', 'VAR2=value3'], 'value1 ${!VAR2} "${!VAR3}"'
        ],
        [
            'Skips variables with invalid name',
            "${1VAR1} ${a:b} ${a:+b} ${a:?b} ${VAR1:0:2} ${VAR1\\val\\lav}", ['VAR1=value1', 'a=value3', 'a:b=value4'], "${1VAR1} ${a:b} ${a:+b} ${a:?b} ${VAR1:0:2} ${VAR1\\val\\lav}"
        ],
        [
            'If variable syntax is incorrect, it should leave it as is',
            '$venv:VAR1 ${_env:VAR2}', ['VAR1=val1', 'VAR2=val2'], '$venv:VAR1 ${_env:VAR2}'
        ],
        [
            'If closing brace is not present, it should leave it as is',
            '$VAR1 ${VAR2', ['VAR1=val1', 'VAR2=val2'], 'val1 ${VAR2',
        ],
        [
            'If closing brace is not present, it should leave it as is 2',
            '${VAR1 ${VAR2}', ['VAR1=val1', 'VAR2=val2'], '${VAR1 ${VAR2}',
        ]
    ]

    for (const [testName, input, variables, expected] of testSuites) {
        it(testName, () => {

            for (const variable of variables) {
                const [name, value] = variable.split('=');
                process.env[name] = value;
            }

            const [result] = expandBashEnvVariables(input);

            assert.deepStrictEqual(result, expected);
        });
    }
};
