/// <reference path='../../definitions/vsts-task-lib.d.ts' />

import path = require('path');
import fs = require('fs');
import xml2js = require('xml2js');

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

import ar = require('./analysisresult');

export const toolName:string = 'PMD';

// Adds PMD goals, if selected by the user
export function applyPmdArgs(mvnRun: trm.ToolRunner):void {
    // This setup will give a [WARNING] during Maven build due to missing cross-reference data when creating HTML output,
    // but generating the data is not related to PMD code analysis. The feature can be disabled with -DlinkXRef=false.
    mvnRun.arg(['pmd:pmd']);
}

// Extract analysis results from PMD output files. We expect PMD to write its analysis results files to their default
// names and locations within the target directory.
// Takes the working directory (should contain pom.xml and target/) and returns an AnalysisResult data class.
// @param sourcesDirectory - The absolute location of the root source directory.
export function collectPmdOutput(rootDir:string) : ar.AnalysisResult {
    var result:ar.AnalysisResult = new ar.AnalysisResult();
    result.toolName = toolName;

    var pmdXmlFilePath = path.join(rootDir, 'target', 'pmd.xml');
    result = collectPmdXml(result, pmdXmlFilePath);

    // if there are no violations, there will be no HTML report
    if (result.totalViolations > 0) {
        var pmdHtmlFilePath = path.join(rootDir, 'target', 'site', 'pmd.html');
        result = collectPmdHtml(result, pmdHtmlFilePath);
    }

    return result;
}

// Verifies the existence of the HTML output file.
// Modifies the relevant field within the returned object accordingly.
function collectPmdHtml(analysisResult:ar.AnalysisResult, path:string):ar.AnalysisResult {
    if (!tl.exist(path)) {
        tl.debug('PMD HTML not found at ' + path);
    } else {
        analysisResult.filesToUpload.push(path);
    }
    return analysisResult;
}

// Verifies the existence of the XML output file and parses its contents.
// Modifies the relevant fields within the returned object accordingly.
function collectPmdXml(analysisResult:ar.AnalysisResult, path:string):ar.AnalysisResult {
    if (!tl.exist(path)) {
        tl.debug('PMD XML not found at ' + path);
    }

    var pmdXmlFileContents = fs.readFileSync(path, 'utf-8');
    xml2js.parseString(pmdXmlFileContents, function (err, data) {
        if (!data || !data.pmd) { // If the file is not in XML, or is from PMD, return immediately
            return analysisResult;
        }

        analysisResult.filesToUpload.push(path);

        if (!data.pmd.file) { // No files with violations, return now that it has been marked for upload
            return analysisResult;
        }

        analysisResult.filesWithViolations = data.pmd.file.length;
        var violationsInFile = 0;

        if (analysisResult.filesWithViolations < 1) {
            // Exit quickly if no violations found
            return analysisResult;
        }

        data.pmd.file.forEach(function (file:any) {
            if (file.violation) {
                violationsInFile += file.violation.length;
            }
        });

        analysisResult.totalViolations = violationsInFile;
    });
    return analysisResult;
}
