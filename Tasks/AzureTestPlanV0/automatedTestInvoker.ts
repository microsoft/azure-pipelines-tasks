import * as tl from 'azure-pipelines-task-lib/task'
import { executepythontests } from './Invokers/pythoninvoker'
import { executemaventests } from './Invokers/maveninvoker'
import { executegradletests } from './Invokers/gradleinvoker'

export async function testInvoker(testsToBeExecuted: string[]): Promise<number> {

    const testLanguageStrings = tl.getDelimitedInput('testLanguageInput', ',', true);

    let exitStatusCode = 0;
    let exitCode = 0;

    for (const testLanguage of testLanguageStrings) {

        if (testLanguage === null || testLanguage === undefined) {
            console.log("Please select the test framework language from the task dropdown list to execute automated tests");
            return;
        }

        switch (testLanguage) {
            case 'Java-Maven':
                exitCode = await executemaventests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Maven: ${exitCode}`);
                break;

            case 'Java-Gradle':
                exitCode = await executegradletests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Gradle: ${exitCode}`);
                break;

            case 'Python':
                exitCode =  await executepythontests(testsToBeExecuted);
                tl.debug(`Execution Status Code for Python: ${exitCode}`);
                break;

            default:
                console.log('Invalid test Language Input selected.');
        }

        if(exitStatusCode == null){
            exitStatusCode = exitCode;
        }
        else{
            exitStatusCode = exitStatusCode || exitCode;
        }
    }
    
    tl.debug(`Execution Status Code for Automated Execution Flow: ${exitStatusCode}`);
    return exitStatusCode
}