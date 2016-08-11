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

/* Code Coverage enabler for different type of build tools and code coverage tools*/
export abstract class CodeCoverageEnabler implements ICodeCoverageEnabler {
    
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

        var inputFilters = classFilter.split(",");
        inputFilters.forEach(inputFilter => {
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

export class CoberturaMavenCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}

export class CoberturaAntCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}

//-----------------------------------------------------
// Interface to be implemented by all code coverage enablers 
//-----------------------------------------------------
export interface ICodeCoverageEnabler {
    //enable code coverage for the given build tool and code coverage tool
    enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean>;
}