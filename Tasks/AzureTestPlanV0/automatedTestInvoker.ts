import * as tl from 'azure-pipelines-task-lib/task'
import { executepythontests } from './Invokers/pythonivoker'
import { executemaventests } from './Invokers/maveninvoker'
import { executegradletests } from './Invokers/gradleinvoker'

export async function testInvoker(testsToBeExecuted: string[]) {

    const testLanguage = tl.getInput('testLanguageInput');

    if (testLanguage !== null && testLanguage !== undefined) {

        if (testLanguage.includes("Java-Maven")) {
            await executemaventests(testsToBeExecuted);
        }
        if (testLanguage.includes("Java-Gradle")) {
            await executegradletests(testsToBeExecuted);
        }
        if (testLanguage.includes("Python")) {
            await executepythontests(testsToBeExecuted);
        }
        else {
            console.log('Language not yet supported for execution');
        }
    }
    else {
        console.log("Please select Test framework language from task dropdown list to execute automated tests");
    }
}