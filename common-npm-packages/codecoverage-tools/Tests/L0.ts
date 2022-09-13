import { codecoverageconstantsTests } from "./codecoverageconstantsTests";
import { codecoveragefactoryTests } from "./codecoveragefactoryTests";
import { codecoverageenablerTests } from "./codecoverageenablerTests";
import { utilitiesTests } from "./utilitiesTests";
import { jacocoantccenablerTests } from "./jacocoantccenablerTests";
import { jacocogradleccenablerTests } from "./jacocogradleccenablerTests";
import { coberturagradleccenablerTests } from "./coberturagradleccenablerTests";

describe("codecoverage-tools suite", function() {
    describe("codecoverageconstants", codecoverageconstantsTests);
    describe("codecoveragefactory", codecoveragefactoryTests);
    describe("codecoverageenabler", codecoverageenablerTests);
    describe("utilities", utilitiesTests);
    describe("jacoco.ant.ccenabler", jacocoantccenablerTests);
    describe("jacoco.gradle.ccenabler", jacocogradleccenablerTests);
    describe("cobertura.gradle.ccenabler", coberturagradleccenablerTests);
});
