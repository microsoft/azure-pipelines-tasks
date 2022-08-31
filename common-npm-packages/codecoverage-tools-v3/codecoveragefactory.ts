
import {ICodeCoverageEnabler} from "./codecoverageenabler";
import {JacocoAntCodeCoverageEnabler} from "./jacoco/jacoco.ant.ccenabler";
import {JacocoGradleCodeCoverageEnabler} from "./jacoco/jacoco.gradle.ccenabler";
import {JacocoMavenCodeCoverageEnabler} from "./jacoco/jacoco.maven.ccenabler";
import {CoberturaAntCodeCoverageEnabler} from "./cobertura/cobertura.ant.ccenabler";
import {CoberturaMavenCodeCoverageEnabler} from "./cobertura/cobertura.maven.ccenabler";
import {CoberturaGradleCodeCoverageEnabler} from "./cobertura/cobertura.gradle.ccenabler";

export interface ICodeCoverageEnablerFactory {
    getTool(buildTool: string, ccTool: string): ICodeCoverageEnabler;
}

export class CodeCoverageEnablerFactory implements ICodeCoverageEnablerFactory {
    public getTool(buildTool: string, ccTool: string): ICodeCoverageEnabler {
        if (!buildTool || !ccTool) {
            throw new Error("Invalid build tool/code coverage tool");
        }

        switch (buildTool.toLowerCase() + "-" + ccTool.toLowerCase()) {
            case "ant-jacoco":
                return new JacocoAntCodeCoverageEnabler();
            case "ant-cobertura":
                return new CoberturaAntCodeCoverageEnabler();
            case "maven-jacoco":
                return new JacocoMavenCodeCoverageEnabler();
            case "maven-cobertura":
                return new CoberturaMavenCodeCoverageEnabler();
            case "gradle-jacoco":
                return new JacocoGradleCodeCoverageEnabler();
            case "gradle-cobertura":
                return new CoberturaGradleCodeCoverageEnabler();
            default:
                throw new Error("Invalid build tool/code coverage tool");
        }
    }
}
