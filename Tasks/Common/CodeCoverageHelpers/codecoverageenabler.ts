/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />

import * as Q from 'q';
import * as str from 'string';
import * as path from 'path';
import * as ccc from './codecoverageconstants';
import * as tl from 'vsts-task-lib/task';
import * as util from './utilities';

//-----------------------------------------------------
// Interface to be implemented by all code coverage enablers 
//-----------------------------------------------------
export interface ICodeCoverageEnabler {
    //enable code coverage for the given build tool and code coverage tool
    enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean>;
}

/* Code Coverage enabler for different type of build tools and code coverage tools*/
export abstract class CodeCoverageEnabler implements ICodeCoverageEnabler {
    protected buildFile: string;

    abstract enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean>;

    //-----------------------------------------------------
    // Convert the VSTS specific filter to Code Coverage Tool specific filter pattern
    // - extractFilters: string  - classFilter
    //-----------------------------------------------------    
    protected extractFilters(classFilter: string) {
        var includeFilter = "";
        var excludeFilter = "";
        var _this = this;

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
                case '+':
                    includeFilter += inputFilter.substr(1);
                    break;
                case '-':
                    excludeFilter += inputFilter.substr(1);
                    break;
                default:
                    throw new Error("Invalid class filter " + inputFilter);
            }
        });

        return {
            includeFilter: includeFilter,
            excludeFilter: excludeFilter
        };
    }
}

abstract class CoberturaCodeCoverageEnabler extends CodeCoverageEnabler {
    protected applyCoberturaFilterPattern(filter: string): string[] {
        let coberturaFilter = [];
        let _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            util.trimToEmptyString(filter).split(":").forEach(exFilter => {
                if (exFilter) {
                    coberturaFilter.push(str(exFilter).endsWith("*") ? ("'.*" + util.trimEnd(exFilter, "*") + ".*'") : ("'.*" + exFilter + "'"));
                }
            });
        }

        return coberturaFilter;
    }
}

abstract class JacocoCodeCoverageEnabler extends CodeCoverageEnabler {
    protected applyJacocoFilterPattern(filter: string): string[] {
        let jacocoFilter = [];
        let _this = this;

        if (!util.isNullOrWhitespace(filter)) {
            str(util.trimToEmptyString(filter)).replaceAll(".", "/").s.split(":").forEach(exFilter => {
                if (exFilter) {
                    jacocoFilter.push(str(exFilter).endsWith("*") ? ("'" + exFilter + "/**'") : ("'" + exFilter + ".class'"));
                }
            });
        }

        return jacocoFilter;
    }
}

