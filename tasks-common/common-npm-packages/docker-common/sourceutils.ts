"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as gitUtils from "./gitutils";

export function getSourceTags(): string[] {
    var tags: string[];

    var sourceProvider = tl.getVariable("Build.Repository.Provider");
    if (!sourceProvider) {
        tl.warning("Cannot retrieve source tags because Build.Repository.Provider is not set.");
        return [];
    }
    if (sourceProvider === "TfsVersionControl") {
        // TFVC has no concept of source tags
        return [];
    }

    var sourceVersion = tl.getVariable("Build.SourceVersion");
    if (!sourceVersion) {
        tl.warning("Cannot retrieve source tags because Build.SourceVersion is not set.");
        return [];
    }

    switch (sourceProvider) {
        case "TfsGit":
        case "GitHub":
        case "Git":
            tags = gitUtils.tagsAt(sourceVersion);
            break;
        case "Subversion":
            // TODO: support subversion tags
            tl.warning("Retrieving Subversion tags is not currently supported.");
            break;
    }

    return tags || [];
}
