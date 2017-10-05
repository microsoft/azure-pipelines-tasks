"use strict";

const nutil = require("nuget-task-common/Utility");
import * as tl from "vsts-task-lib/task";

export function createFoundFilesList(currentTl, searchPatternInput: string, ignoreLegacyFind?: boolean, basePathForLegacyFind?: string): string[] {
    let filesList: string[] = [];
    let searchPatternArray: string[] = nutil.getPatternsArrayFromInput(searchPatternInput);
    let useLegacyFind = currentTl.getVariable("NuGet.UseLegacyFindFiles") === "true";
    let cwd = currentTl.cwd();
    tl.debug(`Current working directory: ${cwd}`);

    if (useLegacyFind) {
        tl.debug(`Using legacy find`);
        // Legacy find fails every time that a file is not found
        filesList = nutil.resolveFilterSpec(searchPatternInput, basePathForLegacyFind);
        filesList.forEach(file => {
            tl.debug(`--File: ${file}`);
        });
    } else {
        searchPatternArray.forEach((pattern: string) => {
            let findOptions: tl.FindOptions = <tl.FindOptions>{};
            let matchOptions: tl.MatchOptions = <tl.MatchOptions>{};
            let filesFound: string[] = [];

            filesFound = currentTl.findMatch(undefined, pattern, findOptions, matchOptions);
            if (filesFound && filesFound.length > 0) {
                filesFound.forEach((file: string) => {
                    if (filesList.indexOf(file) === -1) {
                        filesList.push(file);
                        currentTl.debug(`--File: ${file}`);
                    }
                });
            } else {
                let fullFilePath: string = (pattern.indexOf(cwd) !== -1)
                    ? pattern
                    : cwd + `\\` + pattern;
                currentTl.warning(currentTl.loc("Info_NoMatchingFilesFoundForPattern", fullFilePath));
            }
        });
    }

    tl.debug(`Found ${filesList.length} files`);
    return filesList;
}