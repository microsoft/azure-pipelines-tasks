import tl = require('azure-pipelines-task-lib/task');
import { TestPlanData, createManualTestRun, ManualTestRunData } from './testPlanData';
import { ciDictionary } from './ciEventLogger';
import * as constant from './constants';
import { SimpleTimer } from './SimpleTimer';

export async function manualTestsFlow(testPlanInfo: TestPlanData, ciData: ciDictionary):Promise<number> {

    let manualTestRun: ManualTestRunData = { testRunId: 0, runUrl: "" };

    let simpleTimer = new SimpleTimer(constant.MANUALTESTS_EXECUTION);

    simpleTimer.start();
    try{
        manualTestRun = await createManualTestRun(testPlanInfo);
    }
    catch (err){
        tl.debug(`Unable to create Manual Test Run. Err:( ${err} )`);
        return 1;
    }
    simpleTimer.stop(ciData);
   
    console.log('Test run id created: ', manualTestRun.testRunId);
    console.log('Test run url: ', manualTestRun.runUrl);

    return 0;
}