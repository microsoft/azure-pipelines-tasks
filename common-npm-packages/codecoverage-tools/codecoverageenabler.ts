
import * as Q from "q";
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "./utilities";

// -----------------------------------------------------
// Interface to be implemented by all code coverage enablers 
// -----------------------------------------------------
export interface ICodeCoverageEnabler {
    // enable code coverage for the given build tool and code coverage tool
    enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean>;
}

/* Code Coverage enabler for different type of build tools and code coverage tools*/
export abstract class CodeCoverageEnabler implements ICodeCoverageEnabler {
    protected buildFile: string;

    abstract enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean>;

    // -----------------------------------------------------
    // Convert the Azure Pipelines specific filter to comma seperated specific filter pattern
    // - +:com.abc,-:com.xy -> com.abc,com.xy
    // -----------------------------------------------------    
    protected extractFilters(classFilter: string) {
        let includeFilter = "";
        let excludeFilter = "";

        tl.debug("Extracting Azure Pipelines filter: " + classFilter);
        if (util.isNullOrWhitespace(classFilter)) {
            return {
                includeFilter: includeFilter,
                excludeFilter: excludeFilter
            };
        }

        classFilter.split(",").forEach(inputFilter => {
            if (util.isNullOrWhitespace(inputFilter) || inputFilter.length < 2) {
                throw new Error("Invalid class filter " + inputFilter);
            }

            switch (inputFilter.charAt(0)) {
                case "+":
                    includeFilter += inputFilter.substr(1);
                    break;
                case "-":
                    excludeFilter += inputFilter.substr(1);
                    break;
                default:
                    throw new Error("Invalid class filter " + inputFilter);
            }
        });

        tl.debug("Include Filter pattern: " + includeFilter);
        tl.debug("Exclude Filter pattern: " + excludeFilter);

        return {
            includeFilter: includeFilter,
            excludeFilter: excludeFilter
        };
    }
}

export abstract class CoberturaCodeCoverageEnabler extends CodeCoverageEnabler {
    // -----------------------------------------------------
    // Convert the Azure Pipelines specific filter to Code Coverage Tool specific filter pattern
    // -----------------------------------------------------   
    protected abstract applyFilterPattern(filter: string): string[];
}

export abstract class JacocoCodeCoverageEnabler extends CodeCoverageEnabler {
    // -----------------------------------------------------
    // Convert the Azure Pipelines specific filter to Code Coverage Tool specific filter pattern
    // -----------------------------------------------------   
    protected abstract applyFilterPattern(filter: string): string[];
}
