import * as assert from 'assert';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "../utilities";

import * as expectedResults from './data/expectedResults';
import * as fakeData from './data/fakeData';

export function codecoverageenablerTests() {
    const debugStub = sinon.stub(tl, "debug").callsFake();
    const isNullOrWhitespaceStub = sinon.stub(util, "isNullOrWhitespace").callsFake();

    after(() => {
        debugStub.restore();
        isNullOrWhitespaceStub.restore();
    });

    describe('class CodeCoverageEnabler', () => {
        const codecoverageenablerRewired = rewire('../codecoverageenabler');
        const codeCoverageEnablerClass = codecoverageenablerRewired.__get__('CodeCoverageEnabler')
        const codeCoverageEnablerTestClass = new codeCoverageEnablerClass();

        afterEach(() => {
            isNullOrWhitespaceStub.reset();
        })

        it('function extractFilters should return empty filters when specified empty class filter', () => {
            isNullOrWhitespaceStub.returns(true);
            const actual = codeCoverageEnablerTestClass.extractFilters(fakeData.classFilter);
            assert.deepStrictEqual(actual, expectedResults.emptyFilters);
        });

        it('function extractFilters should throw exception if class filter contains at least one empty filter', () => {
            isNullOrWhitespaceStub
                .onCall(0).returns(false)
                .returns(true);
            assert.throws(() => codeCoverageEnablerTestClass.extractFilters(fakeData.classFilter), Error);
        });

        it('function extractFilters should throw exception if class filter contains at least one filter with length < 2', () => {
            isNullOrWhitespaceStub.returns(false);
            assert.throws(() => codeCoverageEnablerTestClass.extractFilters(fakeData.invalidClassFilter1), Error);
        });

        it('function extractFilters should throw exception if class filter contains at least one unsupported prefix', () => {
            isNullOrWhitespaceStub.returns(false);
            assert.throws(() => codeCoverageEnablerTestClass.extractFilters(fakeData.invalidClassFilter2), Error);
        });

        it('function extractFilters should return correct class filters', () => {
            isNullOrWhitespaceStub.returns(false);
            const actual = codeCoverageEnablerTestClass.extractFilters(fakeData.classFilter);
            assert.deepStrictEqual(actual, expectedResults.correctFilters);
        });
    });
}