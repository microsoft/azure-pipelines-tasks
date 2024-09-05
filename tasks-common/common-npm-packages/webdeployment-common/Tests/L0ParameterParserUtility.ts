import assert = require('assert');
import { parse } from '../ParameterParserUtility';

export function runParameterParserUtilityTests(): void {

    it("Should parse parameters", () => {
        const paramString = "-port 8080 -Release.ReleaseName Release-1173";
        const expectedJSON = {
            "port": {
                value: "8080"
            },
            "Release.ReleaseName": {
                value: "Release-1173"
            }
        };

        const result = parse(paramString);

        assert.deepStrictEqual(result, expectedJSON);
    });

    it("Should parse parameters with empty values", () => {
        const paramString = "-port 8080 -ErrorCode -ErrorMessage -Release.ReleaseName Release-1173";
        const expectedJSON = {
            "port": {
                value: "8080"
            },
            "ErrorCode": {
                value: ""
            },
            "ErrorMessage": {
                value: ""
            },
            "Release.ReleaseName": {
                value: "Release-1173"
            }
        };

        const result = parse(paramString);

        assert.deepStrictEqual(result, expectedJSON);
    });

    it("Should parse parameters with extra spaces", () => {
        const paramString = "-port         8080    -ErrorCode    -ErrorMessage     -Release.ReleaseName         Release-1173";
        const expectedJSON = {
            "port": {
                value: "8080"
            },
            "ErrorCode": {
                value: ""
            },
            "ErrorMessage": {
                value: ""
            },
            "Release.ReleaseName": {
                value: "Release-1173"
            }
        };

        const result = parse(paramString);

        assert.deepStrictEqual(result, expectedJSON);
    });
}
