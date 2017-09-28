"use strict";

export function logFileNotFoundWarning(tl, filesList, searchPatternArray): void {
    let cwd = tl.cwd();
    tl.debug(`Current working directory: ${cwd}`);
    searchPatternArray.forEach((searchPattern: string) => {
        if (filesList.indexOf(searchPattern) === -1) {
            let fullFilePath = (searchPattern.indexOf(cwd) !== -1) 
                ? searchPattern
                : cwd + `\\` + searchPattern;
            tl.warning(tl.loc("Info_NoPackagesMatchedTheSearchPattern", fullFilePath));
        }
    });
}