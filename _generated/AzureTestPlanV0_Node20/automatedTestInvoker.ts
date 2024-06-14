import * as tl from 'azure-pipelines-task-lib/task'
import { executePythonTests } from './Invokers/pythoninvoker'
import { executeMavenTests } from './Invokers/maveninvoker'
import { executeGradleTests } from './Invokers/gradleinvoker'
import { ciDictionary } from './ciEventLogger';
import { executeGoTests } from './Invokers/goinvoker';
export async function testInvoker(testsToBeExecuted: string[], ciData: ciDictionary): Promise<number> {

    const testLanguageStrings = tl.getDelimitedInput('testLanguageInput', ',', true);

    let exitStatusCode = 0;

    for (const testLanguage of testLanguageStrings) {
        let exitCode = 0;

        if (testLanguage === null || testLanguage === undefined) {
            console.log("Please select the test framework language from the task dropdown list to execute automated tests");
            return;
        }

        switch (testLanguage) {
            case 'Java-Maven':
                exitCode = await executeMavenTests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Maven: ${exitCode}`);
                ciData["isJavaMavenExecution"] = true;
                break;

            case 'Java-Gradle':
                exitCode = await executeGradleTests(testsToBeExecuted);
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

            default:
                console.log('Invalid test Language Input selected.');
                ciData["NoLanguageInput"] = true;
        }
        
        exitStatusCode = exitStatusCode || exitCode;
    }
    
    tl.debug(`Execution Status Code for Automated Execution Flow: ${exitStatusCode}`);
    return exitStatusCode;
}