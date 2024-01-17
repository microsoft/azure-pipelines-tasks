import * as tl from 'azure-pipelines-task-lib/task'
import { executepythontests } from './Invokers/pythonivoker'
import { executemaventests } from './Invokers/maveninvoker'
import { executegradletests } from './Invokers/gradleinvoker'

export function testInvoker(testsToBeExecuted: string[]) {

    const testLanguage = tl.getInput('testLanguageInput');

        switch (testLanguage) {
            case "Java-Maven":
                executemaventests(testsToBeExecuted);
                break;
            case "Java-Gradle":
                executegradletests(testsToBeExecuted);
                break;
            case "Python":
                executepythontests(testsToBeExecuted);
                break;
            default:
                console.log('Language not yet supported for execution');
        }
}