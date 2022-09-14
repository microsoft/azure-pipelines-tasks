import { codecoverageconstantsTests } from "./codecoverageconstantsTests";
import { codecoveragefactoryTests } from "./codecoveragefactoryTests";
import { codecoverageenablerTests } from "./codecoverageenablerTests";
import { utilitiesTests } from "./utilitiesTests";
import { jacocoantccenablerTests } from "./jacocoantccenablerTests";
import { jacocogradleccenablerTests } from "./jacocogradleccenablerTests";
import { jacocomavenccenablerTests } from "./jacocomavenccenablerTests";
import { coberturaantccenablerTests } from "./coberturaantccenablerTests";
import { coberturagradleccenablerTests } from "./coberturagradleccenablerTests";
import { coberturamavenccenablerTests } from "./coberturamavenccenablerTests";

describe("codecoverage-tools suite", function() {
    describe("codecoverageconstants", codecoverageconstantsTests);
    describe("codecoveragefactory", codecoveragefactoryTests);
    describe("codecoverageenabler", codecoverageenablerTests);
    describe("utilities", utilitiesTests);
    describe("jacoco.ant.ccenabler", jacocoantccenablerTests);
    describe("jacoco.gradle.ccenabler", jacocogradleccenablerTests);
    describe("jacoco.maven.ccenabler", jacocomavenccenablerTests);
    describe("cobertura.ant.ccenabler", coberturaantccenablerTests);
    describe("cobertura.gradle.ccenabler", coberturagradleccenablerTests);
    describe("cobertura.maven.ccenabler", coberturamavenccenablerTests);
});
