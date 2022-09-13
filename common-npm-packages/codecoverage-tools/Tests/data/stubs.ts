import * as fakeData from './fakeData'

export const getFormattedFileCollectionAssignGradleOutput = function () { return fakeData.getFormattedFileCollectionAssignGradleOutput }
export const jacocoAntCoverageEnableOutput = () => ({
    $:
    {
        "destfile": "some/dir/with/file.build",
        "xmlns:jacoco": "antlib:org.jacoco.ant"
    }
});
export const coberturaAntPropertiesConfiguration = () => `<coberturaAntProperties />`;
export const coberturaAntInstrumentedClassesConfiguration = () => `<cobertura-instrument>some/folder/with/classes</cobertura-instrument>`;
export const coberturaAntClasspathRefConfiguration = () => `<coberturaAntClasspathRef />`;