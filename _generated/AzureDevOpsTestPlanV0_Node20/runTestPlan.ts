import * as tl from 'azure-pipelines-task-lib/task';
import { manualTestsFlow} from './manualTests'
import { automatedTestsFlow} from './automatedTests'

export async function run() {

    const testSelectorInput = tl.getInput('testSelector');
    console.log('Test Selector selected : ' + testSelectorInput);

    if (testSelectorInput === 'manualTests') {
        manualTestsFlow();
    }
    if (testSelectorInput === 'automatedTests') {
        automatedTestsFlow();
    }
}

run();
