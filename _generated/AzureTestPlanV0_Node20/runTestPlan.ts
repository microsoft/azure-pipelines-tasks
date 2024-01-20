import * as tl from 'azure-pipelines-task-lib/task';
import { manualTestsFlow} from './manualTests'
import { automatedTestsFlow} from './automatedTests'

export async function run() {

    const testSelectorInput = tl.getInput('testSelector');
    console.log('Test Selector selected : ' + testSelectorInput);

    // trigger manual, automated or both tests based on user's input
    if (testSelectorInput.includes('manualTests')) {
        manualTestsFlow();
    }
    if (testSelectorInput.includes('automatedTests')) {
        automatedTestsFlow(testSelectorInput);
    }
}

run();
