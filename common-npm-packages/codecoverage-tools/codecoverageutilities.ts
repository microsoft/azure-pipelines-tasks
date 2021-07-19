import Q = require('q');
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from "./utilities";

export function isCodeCoverageFileEmpty(codeCoverageFile: string, codeCoverageTool: string): Q.Promise<boolean> {
    if (!tl.exist(codeCoverageFile)) {
        return Q.resolve(true);
    }
    return util.readXmlFileAsJson(codeCoverageFile)
        .then(function (resp) {
            if (resp) {
                if (codeCoverageTool.toLowerCase() === 'jacoco' && resp.report && resp.report.counter) {
                    return Q.resolve(false);
                }
                else if (codeCoverageTool.toLowerCase() === 'cobertura' && resp.coverage) {
                    let lines_covered: number = Number(resp.coverage.$["lines-covered"]);
                    if (lines_covered && lines_covered > 0) {
                        return Q.resolve(false);
                    }
                }
            }
            return Q.resolve(true);
        });
}