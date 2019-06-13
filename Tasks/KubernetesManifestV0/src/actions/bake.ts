'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import * as  path from 'path';
import * as fs from 'fs';
import * as  helmutility from 'kubernetes-common-v2/helmutility';
import * as uuidV4 from 'uuid/v4';

import { getTempDirectory } from '../utils/FileHelper';
import { Helm, NameValuePair } from 'kubernetes-common-v2/helm-object-model';
import * as TaskParameters from '../models/TaskInputParameters';

class HelmRenderEngine {
    public static async bake() {
        const helmPath = await helmutility.getHelm();
        const helmCommand = new Helm(helmPath, TaskParameters.namespace);
        const helmReleaseName = tl.getInput('releaseName', false);
        const result = helmCommand.template(helmReleaseName, tl.getPathInput('helmChart', true), tl.getDelimitedInput('overrideFiles', '\n'), this.getOverrideValues());
        if (result.stderr) {
            tl.setResult(tl.TaskResult.Failed, result.stderr);
            return;
        }

        const pathToBakedManifest = this.getTemplatePath(result.stdout);
        tl.setVariable('manifestsBundle', pathToBakedManifest);
    }

    private static getTemplatePath(data: string) {
        const paths = path.join(getTempDirectory(), 'baked-template-' + uuidV4() + '.yaml');
        fs.writeFileSync(paths, data);
        return paths;
    }

    private static getOverrideValues() {
        const overridesInput = tl.getDelimitedInput('overrides', '\n');
        const overrideValues = [];
        overridesInput.forEach(arg => {
            const overrideInput = arg.split(':');
            overrideValues.push({
                name: overrideInput[0].trim(),
                value: overrideInput[1].trim()
            } as NameValuePair);
        });

        return overrideValues;
    }
}

export async function bake(ignoreSslErrors?: boolean) {
    const renderType = tl.getInput('renderType', true);
    switch (renderType) {
        case 'helm2':
            await HelmRenderEngine.bake();
            break;
        default:
            throw Error(tl.loc('UnknownRenderType'));
    }
}
