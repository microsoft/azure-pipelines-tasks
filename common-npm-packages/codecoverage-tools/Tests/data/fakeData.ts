export const excludeFilterFake = [
    '**/R.class',
    '**/R$.class'
];
export const excludeFilterFakeStringified = `'${excludeFilterFake.join('\',\'')}'`;
export const includeFilterFake = [
    '**/*$ViewInjector.class',
    '**/*$ViewBinder.class'
];
export const includeFilterFakeStringified = `'${includeFilterFake.join('\',\'')}'`;
export const classDirFake = 'some/folder/with/classes';
export const classDirsFake = 'some/folder1/with/classes,some/folder2/with/classes';
export const sourceDirFake = 'source/dir';
export const sourceDirsFake = 'source/dir1,source/dir2';
export const reportDirFake = 'report/dir';
export const getFormattedFileCollectionAssignGradleOutput = 'fileCollectionAssign';
export const aggregateFake = 'aggregateFake';
export const baseDir = 'base/dir'
export const customerBuildScript = `
plugins {
    id 'java'
}

dependencies {
    testImplementation 'junit:junit:4.13.2'
}`;