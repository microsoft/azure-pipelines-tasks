"use strict";

import * as cp from "child_process";
import * as tl from "azure-pipelines-task-lib/task";

export function tagsAt(commit: string): string[] {
    var git = tl.which("git", true);
    var args = ["tag", "--points-at", commit];
    var gitDir = tl.getVariable("Build.Repository.LocalPath");
    console.log("[command]" + git + " " + args.join(" "));
    var result = (cp.execFileSync(git, args, {
        encoding: "utf8",
        cwd: gitDir
    }) as string).trim();
    console.log(result);
    return result.length ? result.split("\n") : [];
}
