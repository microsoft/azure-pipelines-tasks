import { codecoverageconstantsTests } from "./codecoverageconstantsTests";
import { codecoveragefactoryTests } from "./codecoveragefactoryTests";
import { codecoverageenablerTests } from "./codecoverageenablerTests";
import { utilitiesTests } from "./utilitiesTests";
import { jacocogradleccenablerTests } from "./jacocogradleccenablerTests";

describe("codecoverage-tools suite", function() {
    describe("codecoverageconstants", codecoverageconstantsTests);
    describe("codecoveragefactory", codecoveragefactoryTests);
    describe("codecoverageenabler", codecoverageenablerTests);
    describe("utilities", utilitiesTests);
    describe("jacoco.gradle.ccenabler", jacocogradleccenablerTests);
});
