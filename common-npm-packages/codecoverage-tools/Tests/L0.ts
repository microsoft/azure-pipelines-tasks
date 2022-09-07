import { codecoverageconstantsTests } from "./codecoverageconstantsTests";
import { codecoveragefactoryTests } from "./codecoveragefactoryTests";
import { codecoverageenablerTests } from "./codecoverageenablerTests";

describe("codecoverage-tools suite", function() {
    describe("codecoverageconstants", codecoverageconstantsTests);
    describe("codecoveragefactory", codecoveragefactoryTests);
    describe("codecoverageenabler", codecoverageenablerTests);
});
