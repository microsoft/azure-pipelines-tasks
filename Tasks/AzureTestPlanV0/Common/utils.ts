import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import { Writable } from 'stream';

export function removeParenthesesFromEnd(inputString) {
    // Check if the string ends with parentheses
    if (inputString.endsWith("()")) {
        // Remove the parentheses from the end
        return inputString.slice(0, -2);
    } else {
        // If no parentheses at the end, return the original string
        return inputString;
    }
}

export function replaceLastDotWithHash(inputString) {
    const lastDotIndex = inputString.lastIndexOf('.');

    if (lastDotIndex !== -1) {
        const stringWithHash = inputString.slice(0, lastDotIndex) + '#' + inputString.slice(lastDotIndex + 1);
        return stringWithHash;
    } else {
        // If there is no dot in the string, return the original string
        return inputString;
    }
}

export function extractPythonDiscoveredTests(output: string): string[] {
    var testNames: string[] = [];
    var lines: string[] = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if(line && line.includes(".py")){
            testNames.push(line);
        }
    }
    tl.debug("Discovered tests : " + testNames);
    return testNames;
}

export function separateGoPath(inputString) {
    const lastDotIndex = inputString.lastIndexOf('.');

    if (lastDotIndex !== -1) {
        const stringWith = inputString.slice(0, lastDotIndex);
        return stringWith;
    } else {
        // If there is no dot in the string, return the original string
        return inputString;
    }
}
export function separateGoTestName(inputString) {
    const lastDotIndex = inputString.lastIndexOf('.');

    if (lastDotIndex !== -1) {
        const stringWith = inputString.slice(lastDotIndex + 1);
        return stringWith;
    } else {
        // If there is no dot in the string, return the original string
        return inputString;
    }
}

export function separateJestTestName(inputString) {
    const lastDotIndex = inputString.lastIndexOf('.');

    if (lastDotIndex !== -1) {
        const testName = inputString.slice(lastDotIndex + 1);
        return testName;
    } else {
        return inputString;
    }
}

/*  
    Extracts and returns the substring after the last dot ('.') in the input string i.e. the test name that will be used in grep argument.
    For example, inputString: "tests/test.spec.ts.testName" will return "testName".
*/
export function separatePlaywrightTestName(inputString) {
    const lastDotIndex = inputString.lastIndexOf('.');

    if (lastDotIndex !== -1) {
        const testName = inputString.slice(lastDotIndex + 1);
        return testName;
    } else {
        return inputString;
    }
}

export function getExecOptions(output?: { stdout: string }): tr.IExecOptions {
    const env = process.env;

    const execOptions: tr.IExecOptions = {
        env: env,
        outStream: output ? new Writable({
            write(chunk, encoding, callback) {
                try {
                    output.stdout += chunk.toString();
                    process.stdout.write(chunk);
                    callback();
                } catch (error) {
                    callback(error);
                }
            },
        }) : process.stdout,
    };

    return execOptions;
}

export function transformPythonTestStrings(automatedTestName: string): string {
    // Remove any leading or trailing whitespace
    automatedTestName = automatedTestName.trim();
    let updatedAutomatedTestName: string = automatedTestName;

    const index = automatedTestName.indexOf("::");
    if(index !== -1) {
        let testFilePath = automatedTestName.substring(0, index);
        let testMethod = automatedTestName.substring(index + 2);

        //Check if testfilePath is a python file
        if(testFilePath.endsWith(".py")) {
            testFilePath = testFilePath.slice(0, -3).replace(/\//g, '.');

            //Do the same replace with :: to . in testMethod
            testMethod = testMethod.replace(/::/g, '.');

            //Finally generate updatedAutomatedTestName
            updatedAutomatedTestName = testFilePath + "." + testMethod;
        }
    }
    return updatedAutomatedTestName;
}

export function escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}