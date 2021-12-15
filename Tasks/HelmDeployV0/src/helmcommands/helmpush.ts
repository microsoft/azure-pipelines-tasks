"use strict";

import tl = require('azure-pipelines-task-lib/task');
import { SSL_OP_NO_TLSv1_1 } from 'constants';
import helmcli from "../helmcli";

/*
Pushs a helm chart to ACR (requires helm version 3.7.0 or higher)
*/

export function addArguments(helmCli: helmcli): void {
    console.log(`pushcommand - URBAN \n`);
    if (!helmCli.isHelmV37()) {
        //helm chart save and push commands are only supported in Helms v3  
        throw new Error(tl.loc("PushSupportedInHelmsV7Only"));
    }
    process.env.HELM_EXPERIMENTAL_OCI="1";
    // path to packaged helm chart
    if (!tl.getVariable("helmChartRef")){
         tl.setVariable("helmChartRef","\"" + tl.getInput("packagePath",true) + "\"");
         console.log(tl.getVariable("helmChartRef")+"\n");
    }
    console.log("helmchartref"+tl.getVariable("helmChartRef")+"\n");
    helmCli.addArgument(tl.getVariable("helmChartRef"));
    const acrRepository = tl.getInput("acrRepository",true);
    const azureContainerRegistry = tl.getInput("azureContainerRegistry",true);
    helmCli.addArgument("oci://"+azureContainerRegistry+"/"+acrRepository);

}