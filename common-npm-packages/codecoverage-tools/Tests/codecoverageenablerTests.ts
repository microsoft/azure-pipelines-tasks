import * as assert from 'assert';
import * as rewire from 'rewire';
import { Promise } from 'q';

import * as fakeData from './data/fakeData';
import * as expectedResults from './data/expectedResults';

import * as codecoverageenabler from '../codecoverageenabler';


class CodeCoverageEnablerTestClass extends codecoverageenabler.CodeCoverageEnabler {
    enableCodeCoverage(ccProps: { [name: string]: string; }): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
}

export function codecoverageenablerTests() {
    describe('class CodeCoverageEnabler', () => {
        const codeCoverageEnablerTestClass = new CodeCoverageEnablerTestClass();
        const codeCoverageEnablerTestClassRewired = rewire(codeCoverageEnablerTestClass);
        const extractFilters = codeCoverageEnablerTestClassRewired.__get__('extractFilters');

        it('function extractFilters should return empty filters when specified empty class filter', () => {
            const actual = extractFilters("");
            assert.deepStrictEqual(actual, expectedResults.emptyFilters)
        });

        it('function extractFilters should throw exception if invalid class filter specified #1', () => {
            assert.throws(extractFilters(fakeData.invalidClassFilter1), Error);
        });

        it('function extractFilters should throw exception if invalid class filter specified #2', () => {
            assert.throws(extractFilters(fakeData.invalidClassFilter2), Error);
        });

        it('function extractFilters should return correct class filters', () => {
            const actual = extractFilters(fakeData.correctClassFilter);
            assert.deepStrictEqual(actual, expectedResults.correctFilters);
        });
    });
}