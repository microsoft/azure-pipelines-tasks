import * as tl from 'azure-pipelines-task-lib/task'
import { executepythontests } from './pythonivoker'
import { executemaventests } from './maveninvoker'
import { executegradletests } from './gradleinvoker'


export function testExecutor(testsToBeExecuted: string[]) {

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