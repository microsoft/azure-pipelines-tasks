import * as tl from "vsts-task-lib/task";
import * as path from "path";

import * as nugetRestore from './nugetrestore';
import * as nugetPublish from './nugetpublisher';
import * as nugetPack from './nugetpack';
import * as nugetCustom from './nugetcustom';

async function main(): Promise<void> {
    tl.setResourcePath(path.join(__dirname, "task.json"));

    let nugetCommand = tl.getInput("command", true);
    switch(nugetCommand) {
        case "restore":
            nugetRestore.run();
            break;
        case "pack":
            nugetPack.run();
            break;
        case "push":
            nugetPublish.run();
            break;
        case "custom":
            nugetCustom.run();
            break;
    }
}

main();
