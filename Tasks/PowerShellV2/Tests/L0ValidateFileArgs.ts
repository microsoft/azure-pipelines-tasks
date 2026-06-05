import assert = require('assert');
import { validateFileArgs } from '../helpers';
import { ArgsSanitizingError } from '../errors';

export const runValidateFileArgsTests = () => {
    const notThrowTestSuites: [string, string, string[]][] = [
        [
            "Handles empty line",
            "", []
        ],
        [
            "If no dangerous symbol in present, and FF is on",
            "test 1", ["AZP_75787_ENABLE_NEW_LOGIC=true"]
        ],
        [
            "If dangerous symbols are present, and FF is off",
            "test; test", ['AZP_75787_ENABLE_NEW_LOGIC=false']
        ],
        [
            "If inside the args line is env variable with no dangerous symbols",
            "test $env:VAR1 test", ["VAR1=1", "AZP_75787_ENABLE_NEW_LOGIC=true"]
        ],
        [
            "Accepts allowed symbols",
            "a A z Z 1 \\ ` _ ' \" - = / : . * , + ~ ? % \n #", ["AZP_75787_ENABLE_NEW_LOGIC=true"]
        ],
        [
            "Paths check",
            "D:\\my\\path d/my/path",
            ["AZP_75787_ENABLE_NEW_LOGIC=true"]
        ],
        [
            "Accepts $true and $false",
            "$TrUe $true $fAlsE $false",
            ["AZP_75787_ENABLE_NEW_LOGIC=true"]
        ]
    ];

    for (const [testName, inputArguments, envVariables] of notThrowTestSuites) {
        it(testName, () => {
            envVariables.forEach(envVariable => {
                const [envName, envValue] = envVariable.split("=");
                process.env[envName] = envValue;
            });

            try {
                assert.doesNotThrow(() => validateFileArgs(inputArguments));
            }
            finally {
                envVariables.forEach(envVariable => {
                    const [envName] = envVariable.split("=");
                    delete process.env[envName];
                });
            }
        })
    }

    const throwTestSuites: [string, string, string[]][] = [
        [
            "If dangerous symbols are present, and FF is on",
            "test; whoami", ['AZP_75787_ENABLE_NEW_LOGIC=true']
        ], [
            "If inside args line is env variable with dangerous symbols",
            "test $env:VAR1 test", ["VAR1=12;3", "AZP_75787_ENABLE_NEW_LOGIC=true"]
        ], [
            "If inside args line not correct env syntax",
            "test $venv:VAR1 test", ["VAR1=123", "AZP_75787_ENABLE_NEW_LOGIC=true"]
        ]
    ]
    for (const [testName, inputArguments, envVariables] of throwTestSuites) {
        it(testName, () => {
            envVariables.forEach(envVariable => {
                const [envName, envValue] = envVariable.split("=");
                process.env[envName] = envValue;
            });

            try {
                assert.throws(() => validateFileArgs(inputArguments), ArgsSanitizingError);
            }
            finally {
                envVariables.forEach(envVariable => {
                    const [envName] = envVariable.split("=");
                    delete process.env[envName];
                });
            }
        })
    }

    // Tests for return value behavior
    const returnValueTestSuites: [string, string, string, string[]][] = [
        [
            "Returns original args when no dangerous symbols detected",
            "test 1",
            "test 1",
            ["AZP_75787_ENABLE_COLLECT=true"]
        ],
        [
            "Returns expanded args when unexpanded pipeline variable detected and activate is off",
            '-CertContentBase64 "$(LabAuth)" -CertDirectory "/tmp"',
            '-CertContentBase64 "$(LabAuth)" -CertDirectory "/tmp"',
            ["AZP_75787_ENABLE_COLLECT=true", "AZP_75787_ENABLE_NEW_LOGIC=false"]
        ],
        [
            "Returns original args when no feature flags are set",
            '-CertContentBase64 "$(LabAuth)"',
            '-CertContentBase64 "$(LabAuth)"',
            []
        ]
    ];

    for (const [testName, inputArguments, expectedResult, envVariables] of returnValueTestSuites) {
        it(testName, () => {
            envVariables.forEach(envVariable => {
                const [envName, envValue] = envVariable.split("=");
                process.env[envName] = envValue;
            });

            try {
                const result = validateFileArgs(inputArguments);
                assert.strictEqual(result, expectedResult);
            }
            finally {
                envVariables.forEach(envVariable => {
                    const [envName] = envVariable.split("=");
                    delete process.env[envName];
                });
            }
        })
    }
}