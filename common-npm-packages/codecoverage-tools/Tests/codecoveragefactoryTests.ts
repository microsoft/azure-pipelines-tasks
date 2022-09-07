import assert = require("assert");
import { CodeCoverageEnablerFactory } from "../codecoveragefactory";

export function codecoveragefactoryTests() {

    it('should throw exception if specified tool doesn\'t exist', function () {
        const factory = new CodeCoverageEnablerFactory();
        const buildTool = 'Not exist build tool';
        const ccTool = 'Not exist code coverage tool';

        assert.throws(
            () => {factory.getTool(buildTool, ccTool)}, 
            Error);
    });
}