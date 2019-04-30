"use strict";

import tl = require('vsts-task-lib/task');
import path = require('path');
import fs = require('fs');
import { getTempDirectory } from "../utils/FileHelper";
import helmutility = require("utility-common/helmutility");
import { Helm, NameValuePair } from "utility-common/helm-object-model";

const uuidV4 = require('uuid/v4');

export async function bake() {
    let renderType = tl.getInput("renderType", true);
    switch (renderType) {
        case "helm2":
            await HelmRenderEngine.bake();
            break;
        default:
            throw Error(tl.loc("UnknownRenderType"));
    }
}

class HelmRenderEngine {
    public static async bake() {
        let helmPath = await helmutility.getHelm();
        let helmCommand = new Helm(helmPath, tl.getInput("namespace"));
        var result = helmCommand.template(tl.getPathInput("helmChart", true), tl.getDelimitedInput("overrideFiles", "\n"), this.getOverrideValues());
        if (result.stderr) {
            tl.setResult(tl.TaskResult.Failed, result.stderr);
            return;
        }

        let pathToBakedManifest = this.getTemplatePath(result.stdout);
        tl.setVariable("manifestsBundle", pathToBakedManifest);
    }

    private static getTemplatePath(data) {
        var paths = path.join(getTempDirectory(), "baked-template-" + uuidV4() + ".yaml");
        fs.writeFileSync(paths, data)
        return paths;
    }

    private static getOverrideValues() {
        let overridesInput = tl.getDelimitedInput("overrides", "\n");
        var overrideValues = [];
        overridesInput.forEach(arg => {
            let overrideInput = arg.split(":");
            overrideValues.push({
                name: overrideInput[0].trim(),
                value: overrideInput[1].trim()
            } as NameValuePair);
        });

        return overrideValues;
    }
}