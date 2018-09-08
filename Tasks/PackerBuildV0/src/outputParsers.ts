"use strict";

import * as os from "os";
import * as util from "util"
import * as utils from "./utilities";
import * as tl from "vsts-task-lib/task";
import * as definitions from "./definitions"

export default class OutputVariablesParser implements definitions.IOutputParser {

    constructor(outputExtractionKeys?: string[]) {
        this._outputExtractionKeys = outputExtractionKeys;
        this._extractedOutputs = new Map<string, string>();
    }

    public parse(log: string): void {
        if(utils.IsNullOrEmpty(log) || !utils.HasItems(this._outputExtractionKeys)) {
            return;
        }

        tl.debug("Parsing log line to extract output...");
        tl.debug("/*************************************")
        tl.debug(log);
        tl.debug("**************************************/")

        this._outputExtractionKeys.forEach((key: string) => {
            var keyValue = this._extractOutputValue(log, key);
            if(keyValue !== null) {
                this._extractedOutputs.set(key, keyValue);
            }
        })
    }

    public getExtractedOutputs(): any {
        return this._extractedOutputs;
    }

    private _extractOutputValue(log: string, key: string): string {
        var matchingInfoStartIndex = log.search(util.format("(\\n|\\r|\\u2028|\\u2029|^)%s: .*(\\n|\\r|\\u2028|\\u2029)", key));
        tl.debug("Match start index: " + matchingInfoStartIndex);

        if (matchingInfoStartIndex !== -1) {
            var padding = 1;
            
            if(log.startsWith(key)) {
                padding = 0;
            }
            var matchingInfo = log.substring(matchingInfoStartIndex + key.length + padding + 1).trim(); // one extra character is for ':' preceding the key
            var matchingInfoEndIndex = matchingInfo.search("(\\n|\\r|\\u2028|\\u2029)");
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
    private _extractedOutputs: Map<string, string>;
}