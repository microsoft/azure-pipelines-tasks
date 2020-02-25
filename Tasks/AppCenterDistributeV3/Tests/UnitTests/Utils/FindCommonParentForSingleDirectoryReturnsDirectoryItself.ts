import fs = require('fs');

import { findCommonParent } from '../../../utils';
import { assertByExitCode } from '../TestHelpers';

fs.lstatSync = (s: string) => {
    const stat = {} as fs.Stats;
    stat.isFile = () => s.endsWith('.so');
    stat.isSymbolicLink = () => false;
    return stat;
}
const expectedParentPath = "/a/b/c";
const actualParentPath = findCommonParent(["/a/b/c"]);
assertByExitCode.equal(actualParentPath, expectedParentPath);
