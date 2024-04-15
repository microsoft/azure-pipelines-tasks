import * as tl from 'azure-pipelines-task-lib/task'
import { executePythonTests } from './Invokers/pythoninvoker'
import { executeMavenTests } from './Invokers/maveninvoker'
import { executeGradleTests } from './Invokers/gradleinvoker'

export async function testInvoker(testsToBeExecuted: string[]): Promise<number> {

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
                break;

            case 'Java-Gradle':
                exitCode = await executeGradleTests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Gradle: ${exitCode}`);
                break;

            case 'Python':
                exitCode =  await executePythonTests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Python: ${exitCode}`);
                break;

            default:
                console.log('Invalid test Language Input selected.');
        }
        
        exitStatusCode = exitStatusCode || exitCode;
    }
    
    tl.debug(`Execution Status Code for Automated Execution Flow: ${exitStatusCode}`);
    return exitStatusCode;
}