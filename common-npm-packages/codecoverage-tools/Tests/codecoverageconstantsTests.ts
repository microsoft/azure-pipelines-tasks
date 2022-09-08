import * as assert from 'assert';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as util from "../utilities";

import * as stubs from './data/stubs';
import * as fakeData from './data/fakeData';
import * as expectedResults from './data/expectedResults';

const codecoverageconstantsRewire = rewire('../codecoverageconstants');
const getFormattedFileCollectionAssignGradle = codecoverageconstantsRewire.__get__('getFormattedFileCollectionAssignGradle');

export function codecoverageconstantsTests() {
    describe('function getFormattedFileCollectionAssignGradle', () => {
        it ('should return syntax for Gradle < 5.x', () => {
            const property = 'testProperty';
            
            const expected = `${property} =`
            const actual = getFormattedFileCollectionAssignGradle(property, false);
    
            assert.strictEqual(actual, expected);
        })
    
        it ('should return syntax for Gradle >= 5.x', () => {
            const property = 'testProperty';
            
            const expected = `${property}.setFrom`
            const actual = getFormattedFileCollectionAssignGradle(property, true);
    
            assert.strictEqual(actual, expected);
        })    
    });

    describe('functions related to build script configuration', () => {
        before(() => {
            codecoverageconstantsRewire.__set__('getFormattedFileCollectionAssignGradle', stubs.getFormattedFileCollectionAssignGradleOutput);
        });

        after(() => {
            codecoverageconstantsRewire.__set__('getFormattedFileCollectionAssignGradle', getFormattedFileCollectionAssignGradle);
        });

        it('function jacocoGradleSingleModuleEnable should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.jacocoGradleSingleModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, fakeData.classDir, fakeData.reportDir, false);
            assert.strictEqual(actual, expectedResults.jacocoGradleSingleModule);
        });

        it('function jacocoGradleMultiModuleEnable should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.jacocoGradleMultiModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, fakeData.classDir, fakeData.reportDir, false);
            assert.strictEqual(actual, expectedResults.jacocoGradleMultiModule);
        });

        it('function coberturaGradleSingleModuleEnable should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.coberturaGradleSingleModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, fakeData.classDir, fakeData.sourceDir, fakeData.reportDir);
            assert.strictEqual(actual, expectedResults.coberturaGradleSingleModule);
        });

        it('function coberturaGradleSingleModuleEnable should return correct configuration if source dir is not specified', () => {
            const actual = codecoverageconstantsRewire.coberturaGradleSingleModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, fakeData.classDir, null, fakeData.reportDir);
            assert.strictEqual(actual, expectedResults.coberturaGradleSingleModuleWithNotSpecifiedSourceDir);
        });

        it('function coberturaGradleSingleModuleEnable should return correct configuration if class dir is not specified', () => {
            const actual = codecoverageconstantsRewire.coberturaGradleSingleModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, null, fakeData.sourceDir, fakeData.reportDir);
            assert.strictEqual(actual, expectedResults.coberturaGradleSingleModuleWithNotSpecifiedClassDir);
        });

        it('function coberturaGradleMultiModuleEnable should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.coberturaGradleMultiModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, fakeData.classDir, fakeData.sourceDir, fakeData.reportDir);
            assert.strictEqual(actual, expectedResults.coberturaGradleMultiModule);
        });

        it('function coberturaGradleMultiModuleEnable should return correct configuration if source dir is not specified', () => {
            const actual = codecoverageconstantsRewire.coberturaGradleMultiModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, fakeData.classDir, null, fakeData.reportDir);
            assert.strictEqual(actual, expectedResults.coberturaGradleMultiModuleWithNotSpecifiedSourceDir);
        });

        it('function coberturaGradleMultiModuleEnable should return correct configuration if class dir is not specified', () => {
            const actual = codecoverageconstantsRewire.coberturaGradleMultiModuleEnable(fakeData.excludeFilterStringified, fakeData.includeFilterStringified, null, fakeData.sourceDir, fakeData.reportDir);
            assert.strictEqual(actual, expectedResults.coberturaGradleMultiModuleWithNotSpecifiedClassDir);
        });

        it('function jacocoMavenPluginEnable  should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.jacocoMavenPluginEnable(fakeData.includeFilter, fakeData.excludeFilter, fakeData.reportDir);
            assert.deepStrictEqual(actual, expectedResults.jacocoMavenSingleProject);
        });

        it('function jacocoMavenMultiModuleReport should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.jacocoMavenMultiModuleReport(fakeData.reportDir, fakeData.sourceDirs, fakeData.classDirs, fakeData.includeFilterStringified, fakeData.excludeFilterStringified);
            assert.strictEqual(actual, expectedResults.jacocoMavenMultiProject);
        });

        it('function coberturaMavenEnable should call \'util.convertXmlStringToJson\' once with correct parameters', async () => {
            const convertXmlStringToJsonStub = sinon.stub(util, "convertXmlStringToJson").callsFake();
            codecoverageconstantsRewire.coberturaMavenEnable(fakeData.includeFilterStringified, fakeData.excludeFilterStringified, fakeData.aggregate);
            sinon.assert.calledOnceWithExactly(convertXmlStringToJsonStub, expectedResults.coberturaMavenEnableConfiguration);
            convertXmlStringToJsonStub.restore();
        });

        it('function jacocoAntReport should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.jacocoAntReport(fakeData.reportDir, fakeData.classDir, fakeData.sourceDir);
            assert.strictEqual(actual, expectedResults.jacocoAntReportConfiguration);
        });

        it('function jacocoAntReport should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.jacocoAntReport(fakeData.reportDir, fakeData.classDir, fakeData.sourceDir);
            assert.strictEqual(actual, expectedResults.jacocoAntReportConfiguration);
        });

        it('function jacocoAntCoverageEnable should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.jacocoAntCoverageEnable(fakeData.reportDir);
            assert.deepStrictEqual(actual, expectedResults.jacocoAntCoverageEnableConfiguration);
        });

        it('function coberturaAntReport should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.coberturaAntReport(fakeData.sourceDir, fakeData.reportDir);
            assert.deepStrictEqual(actual, expectedResults.coberturaAntReportConfiguration);
        });

        it('function coberturaAntInstrumentedClasses should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.coberturaAntInstrumentedClasses(fakeData.baseDir, fakeData.reportDir, fakeData.classDir);
            assert.deepStrictEqual(actual, expectedResults.coberturaAntInstrumentedClassesConfiguration);
        });

        it('function coberturaAntProperties should return correct configuration', () => {
            const actual = codecoverageconstantsRewire.coberturaAntProperties(fakeData.reportDir, fakeData.baseDir);
            assert.deepStrictEqual(actual, expectedResults.coberturaAntPropertiesConfiguration);
        });
    });
}