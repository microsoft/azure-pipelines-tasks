import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";

async function run() {
    tl.setResourcePath(path.join(__dirname, "task.json"));
    const pypircPath = tl.getVariable("PYPIRC_PATH");
    if (tl.exist(pypircPath)) {
        tl.debug(tl.loc("Info_RemovingPypircFile", pypircPath));
        tl.rmRF(pypircPath);
    }
    else {
        console.log(tl.loc("NoPypircFile"));
    }
}
run();
