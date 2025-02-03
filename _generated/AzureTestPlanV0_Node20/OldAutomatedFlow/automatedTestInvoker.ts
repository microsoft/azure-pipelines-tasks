import * as tl from 'azure-pipelines-task-lib/task'
import { executePythonTests } from '../OldAutomatedFlow/Invokers/pythoninvoker'
import { executeMavenTests } from '../OldAutomatedFlow/Invokers/maveninvoker'
import { executeGradleTests } from '../OldAutomatedFlow/Invokers/gradleinvoker'
import { ciDictionary } from '../Common/ciEventLogger';
import { executeGoTests } from '../OldAutomatedFlow/Invokers/goinvoker';
import { executeJestTests } from '../OldAutomatedFlow/Invokers/jestinvoker';

export async function testInvoker(testsToBeExecuted: string[], ciData: ciDictionary): Promise<number> {

    const testLanguage = tl.getInput('testLanguageInput', true);
    const pomFilePath = tl.getInput('pomFilePath');
    const gradleFilePath = tl.getInput('gradleFilePath');

    let exitStatusCode = 0;
    let exitCode = 0;

        if (testLanguage === null || testLanguage === undefined) {
            console.log("Please select the test framework language from the task dropdown list to execute automated tests");
            return;
        }

        switch (testLanguage) {
            case 'JavaMaven':
                exitCode = await executeMavenTests(testsToBeExecuted, pomFilePath);
                tl.debug(`Execution Status Code for Maven: ${exitCode}`);
                ciData["isJavaMavenExecution"] = true;
                break;

            case 'JavaGradle':
                exitCode = await executeGradleTests(testsToBeExecuted, gradleFilePath);
                tl.debug(`Execution Status Code for Gradle: ${exitCode}`);
                ciData["isJavaGradleExecution"] = true;
                break;

            case 'Python':
                exitCode =  await executePythonTests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Python: ${exitCode}`);
                ciData["isPythonExecution"] = true;
                break;

            case 'Go':
                exitCode = await executeGoTests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Go: ${exitCode}`);
                ciData["isGoExecution"] = true;
                break;

            case 'Jest':
                exitCode = await executeJestTests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Jest: ${exitCode}`);
                ciData["isJestExecution"] = true;
                break;

            default:
                console.log('Invalid test Language Input selected.');
                ciData["NoLanguageInput"] = true;
        }
        
        exitStatusCode = exitStatusCode || exitCode;
    
    tl.debug(`Execution Status Code for Automated Execution Flow: ${exitStatusCode}`);
    return exitStatusCode;
}