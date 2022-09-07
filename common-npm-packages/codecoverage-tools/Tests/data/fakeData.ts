export const excludeFilter = [
    '**/R.class',
    '**/R$.class'
];
export const excludeFilterStringified = `'${excludeFilter.join('\',\'')}'`;
export const includeFilter = [
    '**/*$ViewInjector.class',
    '**/*$ViewBinder.class'
];
export const includeFilterStringified = `'${includeFilter.join('\',\'')}'`;
export const classDir = 'some/folder/with/classes';
export const classDirs = 'some/folder1/with/classes,some/folder2/with/classes';
export const sourceDir = 'source/dir';
export const sourceDirs = 'source/dir1,source/dir2';
export const reportDir = 'report/dir';
export const getFormattedFileCollectionAssignGradleOutput = 'fileCollectionAssign';
export const aggregate = 'aggregateFake';
export const baseDir = 'base/dir'
export const invalidClassFilter1 = '-:**/R,-:';
export const invalidClassFilter2 = '-:**/R,?:**/R$,-:**/*$ViewInjector';
export const correctClassFilter = '+:**/R,+:**/R$,-:**/*$ViewInjector,-:**/*$ViewBinder,+:**/BuildConfig,-:**/Manifest';