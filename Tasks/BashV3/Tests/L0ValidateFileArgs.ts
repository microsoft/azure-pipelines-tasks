import assert = require('assert');
import { validateFileArgs } from '../helpers';
import { ArgsSanitizingError } from '../utils/errors';

export const runValidateFileArgsTests = () => {
    const notThrowTestSuites: [string, string, string[]][] = [
        [
            "Handles empty line",
            "", []
        ], [
            "If no dangerous symbol in present, and FF is on",
            "test 1", ["AZP_75787_ENABLE_NEW_LOGIC=true"]
        ], [
            "If dangerous symbols are present, and FF is off",
            "test; test", ['AZP_75787_ENABLE_NEW_LOGIC=false']
        ], [
            "If inside the args line is env variable with no dangerous symbols",
            "test $VAR1 test", ["VAR1=1", "AZP_75787_ENABLE_NEW_LOGIC=true"]
        ], [
            "Accepts allowed symbols",
            "a A 1 \\ _ ' \" - = / : . * + %", ["AZP_75787_ENABLE_NEW_LOGIC=true"]
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
            "test $VAR1 test", ["VAR1=12;3", "AZP_75787_ENABLE_NEW_LOGIC=true"]
        ], [
            "If inside args line not correct env syntax",
            "test ${VAR1 test", ["VAR1=123", "AZP_75787_ENABLE_NEW_LOGIC=true"]
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
}