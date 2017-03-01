"use strict";

import * as os from "os";
import * as util from "util"
import * as utils from "./utilities";
import * as tl from "vsts-task-lib/task";

export interface IOutputParser {
    parse(line: string, parsedOutputs: Map<string, string>): void;
}

export class OutputVariablesExtractor implements IOutputParser {

    constructor(outputExtractionKeys?: string[]) {
        this._outputExtractionKeys = outputExtractionKeys;
        //this._extractedOutputs = new Map<string, string>();
    }

    public parse(line: string, parsedOutputs: Map<string, string>): void {
        //var extractedOutputs = new Map<string, string>();

        if(utils.IsNullOrEmpty(line) || utils.HasItems(this._outputExtractionKeys)) {
            return;
        }

        tl.debug("Parsing log line to extract output...");
        tl.debug("/*************************************")
        tl.debug(line);
        tl.debug("**************************************/")

        this._outputExtractionKeys.forEach((key: string) => {
            var keyValue = this._extractOutputValue(line, key);
            if(keyValue !== null) {
                parsedOutputs.set(key, keyValue);
            }
        })
    }

    private _extractOutputValue(line: string, key: string): string {
        var matchingInfoStartIndex = line.search(util.format("%s: \\S*(\\n|\\r|\\u2028|\\u2029|\\s)", key));
        tl.debug("Match start index: " + matchingInfoStartIndex);

        if (matchingInfoStartIndex !== -1) {
            var matchingInfo = line.substring(matchingInfoStartIndex + key.length + 1).trim();
            var matchingInfoEndIndex = matchingInfo.search("(\\n|\\r|\\u2028|\\u2029|\\s)");
            tl.debug("Match end index: " + matchingInfoEndIndex);

            if (matchingInfoEndIndex !== -1) {
                matchingInfo = matchingInfo.substring(0, matchingInfoEndIndex).trim();
            }

            var matchingValue = matchingInfo;
            tl.debug("...found match for key " + key + " value: " + matchingValue);
            return matchingValue;
        }

        return null;
    }

    private _outputExtractionKeys: string[];
    //private _extractedOutputs: Map<string, string>;
}