import path = require('path');
import os = require('os');
import tl = require('azure-pipelines-task-lib/task');
tl.setResourcePath(path.join(__dirname, 'task.json'));

(() => {
    // contents is a multiline input containing glob patterns
    let patterns: string[] = tl.getDelimitedInput('Contents', '\n', true);

    let sourceFolder: string = tl.getPathInput('SourceFolder', true, false);

    // Input that is used for backward compatibility with pre-sprint 95 symbol store artifacts.
    // Pre-95 symbol store artifacts were simply file path artifacts, so we need to make sure
    // not to delete the artifact share if it's a symbol store.
    let buildCleanup: boolean = tl.getBoolInput('BuildCleanup');

    // trim whitespace and root each pattern
    patterns = patterns
        .map((pattern: string) => pattern.trim())
        .filter((pattern: string) => pattern != '')
        .map((pattern: string) => path.join(sourceFolder, pattern));
    tl.debug(`patterns: ${patterns}`);

    // short-circuit if no patterns
    if (!patterns.length) {
        tl.debug('no patterns specified');
        return;
    }

    // find all files
    let foundPaths = tl.find(sourceFolder);

    // short-circuit if not exists
    if (!foundPaths.length) {
        tl.debug('source folder not found. nothing to delete.');
        tl.setResult(tl.TaskResult.Succeeded, tl.loc("NoFiles"));
        return;
    }

    // Don't delete symbol store shares if this is a cleanup job for file-path artifacts.
    //
    // This check needs to be made based on the result of tl.find(). Otherwise intermittent network
    // issues could result in a false assertion that the share is not a symbol store share.
    //
    // Opted to check each item name rather than the full path. Although it would suffice to check
    // for 000Admin at the root of the share, it is difficult to accurately make a determination
    // based on the full path. The problem is that the input share path would need to be run through
    // a normalization function that could be trusted 100% to match the format produced by tl.find().
    // For example if the input contains "\\\share", it would need to be normalized as "\\share". To
    // avoid worrying about catching every normalization edge case, checking the item name suffices instead.
    if (buildCleanup &&
        foundPaths.some((itemPath: string) => path.basename(itemPath).toLowerCase() == '000admin')) {

        tl.warning(tl.loc('SkippingSymbolStore', sourceFolder))
        return;
    }

    // minimatch options
    let matchOptions = { matchBase: true };
    if (os.type().match(/^Win/)) {
        matchOptions["nocase"] = true;
    }

    // apply the match patterns
    let matches: string[] = tl.match(foundPaths, patterns, null, matchOptions);

    // sort by length (descending) so files are deleted before folders
    matches = matches.sort((a: string, b: string) => {
        if (a.length == b.length) {
            return 0;
        }

        return a.length > b.length ? -1 : 1;
    });

    // try to delete all files/folders, even if one errs
    let errorHappened: boolean = false;
    for (let itemPath of matches) {
        try {
            tl.rmRF(itemPath);
        }
        catch (err) {
            tl.error(err);
            errorHappened = true;
        }
    }

    if (errorHappened) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("CantDeleteFiles"));
    }
})();
