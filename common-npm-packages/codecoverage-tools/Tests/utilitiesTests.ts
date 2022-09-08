import * as assert from 'assert';
import * as sinon from 'sinon';
import * as tl from 'azure-pipelines-task-lib/task'
import * as utilities from '../utilities';

import * as expectedResults from './data/expectedResults';
import * as fakeData from './data/fakeData';

export function utilitiesTests() {
    const sandbox = sinon.createSandbox();
    
    before(() => {
        sandbox.stub(tl, "debug").callsFake();
    })

    after(() => {
        sandbox.restore();
    });

    it('function sharedSubString should return empty string if there is no common substring', () => {
        const actual = utilities.sharedSubString(fakeData.sharedSubString1, fakeData.sharedSubString2)
        assert.strictEqual(actual, "");
    });

    it('function sharedSubString should common substring', () => {
        const actual = utilities.sharedSubString(fakeData.sharedSubString1, fakeData.sharedSubString3)
        assert.strictEqual(actual, "ab");
    });

    it('function sortStringArray should sort string in ascending order', () => {
        const actual = utilities.sortStringArray(fakeData.stringArray);
        assert.deepStrictEqual(actual, expectedResults.sortedStringArray); 
    });

    it('function sortStringArray should sort string in ascending order', () => {
        const actual = utilities.sortStringArray(fakeData.stringArray);
        assert.deepStrictEqual(actual, expectedResults.sortedStringArray); 
    });

    it('function isNullOrWhitespace should return true if specified string is null', () => {
        const actual = utilities.isNullOrWhitespace(null);
        assert.strictEqual(actual, true);
    });

    it('function isNullOrWhitespace should return true if specified string is whitespace', () => {
        const actual = utilities.isNullOrWhitespace("    ");
        assert.strictEqual(actual, true);
    });

    it('function isNullOrWhitespace should return false if specified string is not null or whitespace', () => {
        const actual = utilities.isNullOrWhitespace("fake string");
        assert.strictEqual(actual, false);
    });

    it('function trimToEmptyString should return empty string if specified string is null', () => {
        const actual = utilities.trimToEmptyString(null);
        assert.strictEqual(actual, "");
    });

    it('function trimToEmptyString should return trimmed string', () => {
        const actual = utilities.trimToEmptyString(" fake string ");
        assert.strictEqual(actual, fakeData.string);
    });

    it('function trimEnd should return specified string if specified trim char is null', () => {
        const actual = utilities.trimEnd(fakeData.string, null);
        assert.strictEqual(actual, fakeData.string);
    });

    it('function trimEnd should return null if specified string is null', () => {
        const actual = utilities.trimEnd(null, "q");
        assert.strictEqual(actual, null);
    });

    it('function trimEnd should return string without specified char at the end', () => {
        const actual = utilities.trimEnd(fakeData.string, "g");
        assert.strictEqual(actual, "fake strin");
    });

    it('function trimEnd should return specified string if there is no specified trim char at the end', () => {
        const actual = utilities.trimEnd(fakeData.string, "r");
        assert.strictEqual(actual, fakeData.string);
    });

    it('function addPropToJson should return object with added property', () => {
        const jsonObj = {
            firstProperty: "First Value",
            secondProperty: "Second Value"
        }
        utilities.addPropToJson(jsonObj, fakeData.propertyName, fakeData.propertyValue);
        assert.deepStrictEqual(jsonObj, expectedResults.objectWithAddedProperty);
    });

    it('function addPropToJson should convert property to array and add specified value if property already exist', () => {
        const jsonObj = {
            firstProperty: "First Value",
            secondProperty: "Second Value",
            someProperty: 42
        }
        utilities.addPropToJson(jsonObj, fakeData.propertyName, fakeData.propertyValue);
        assert.deepStrictEqual(jsonObj, expectedResults.objectWithAddedPropertyIntoArray);
    });

    it('function addPropToJson should push specified value if specified property already exist as array', () => {
        const jsonObj = {
            firstProperty: "First Value",
            secondProperty: "Second Value",
            someProperty: [42]
        }
        utilities.addPropToJson(jsonObj, fakeData.propertyName, fakeData.propertyValue);
        assert.deepStrictEqual(jsonObj, expectedResults.objectWithAddedPropertyIntoArray);
    });

    it('function addPropToJson should add property in new element of array if it\'s specified as parameter', () => {
        const jsonObj = [
            {
                firstProperty: "First Value",
                secondProperty: "Second Value"
            },
            {
                firstProperty: "First Value",
            }
        ]
        utilities.addPropToJson(jsonObj, fakeData.propertyName, fakeData.propertyValue);
        assert.deepStrictEqual(jsonObj, expectedResults.arrayWithAddedProperty);
    });

    it('function addPropToJson should add append specified value to specified property if it\'s in array element', () => {
        const jsonObj = [
            {
                firstProperty: "First Value",
            },
            {
                firstProperty: "First Value",
                someProperty: 42
            }
        ]
        utilities.addPropToJson(jsonObj, fakeData.propertyName, fakeData.propertyValue);
        assert.deepStrictEqual(jsonObj, expectedResults.arrayWithAppendedProperty);
    });
}