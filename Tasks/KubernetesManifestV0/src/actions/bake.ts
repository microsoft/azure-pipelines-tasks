'use strict';

import * as tl from 'azure-pipelines-task-lib/task';
import * as  path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as  helmutility from 'azure-pipelines-tasks-kubernetes-common-v2/helmutility';
import * as uuidV4 from 'uuid/v4';
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';

import { getTempDirectory } from '../utils/FileHelper';
import { Helm, NameValuePair } from 'azure-pipelines-tasks-kubernetes-common-v2/helm-object-model';
import * as TaskParameters from '../models/TaskInputParameters';
import { KomposeInstaller } from '../utils/installers';
import * as utils from '../utils/utilities';
import * as DeploymentHelper from '../utils/DeploymentHelper';
import * as TaskInputParameters from '../models/TaskInputParameters';

abstract class RenderEngine {
    public bake: () => Promise<any>;
    protected getTemplatePath = () => {
        return path.join(getTempDirectory(), 'baked-template-' + uuidV4() + '.yaml');
    }
    protected updateImages(filePath: string) {
        if (TaskInputParameters.containers.length > 0 && fs.existsSync(filePath)) {
            const updatedFilesPaths: string[] = DeploymentHelper.updateResourceObjects([filePath], [], TaskInputParameters.containers);
            let fileContents: string[] = [];
            updatedFilesPaths.forEach((path) => {
                const content = yaml.safeDump(JSON.parse(fs.readFileSync(path).toString()));
                fileContents.push(content);
            });
            fs.writeFileSync(filePath, fileContents.join("\n---\n"));
        }
    }
}

class HelmRenderEngine extends RenderEngine {
    public bake = async (): Promise<any> => {
        // Helm latest releases require restricted permissions on Kubeconfig
        const kubeconfigPath = tl.getVariable('KUBECONFIG');
        if (kubeconfigPath)
            fs.chmodSync(kubeconfigPath, '600');
        const helmPath = await helmutility.getHelm();
        const helmCommand = new Helm(helmPath, TaskParameters.namespace);
        const helmReleaseName = tl.getInput('releaseName', false);
        const result = helmCommand.template(helmReleaseName, tl.getPathInput('helmChart', true), tl.getDelimitedInput('overrideFiles', '\n'), this.getOverrideValues());
        if (result.stderr) {
            tl.setResult(tl.TaskResult.Failed, result.stderr);
            return;
        }
        tl.debug(result.stdout);
        const pathToBakedManifest = this.getTemplatePath();
        fs.writeFileSync(pathToBakedManifest, result.stdout);
        this.updateImages(pathToBakedManifest);
        tl.setVariable('manifestsBundle', pathToBakedManifest);
    }

    private getOverrideValues() {
        const overridesInput = tl.getDelimitedInput('overrides', '\n');
        const overrideValues = [];
        overridesInput.forEach(arg => {
            const overrideInput = arg.split(':');
            const overrideName = overrideInput[0];
            const overrideValue = overrideInput.slice(1).join(':');
            overrideValues.push({
                name: overrideName,
                value: overrideValue
            } as NameValuePair);
        });

        return overrideValues;
    }
}

class KomposeRenderEngine extends RenderEngine {
    public bake = async (): Promise<any> => {
        if (!tl.filePathSupplied('dockerComposeFile')) {
            throw new Error(tl.loc('DockerComposeFilePathNotSupplied'));
        }

        const dockerComposeFilePath = tl.getPathInput('dockerComposeFile', true, true);
        const installer = new KomposeInstaller();
        let path = installer.checkIfExists();
        if (!path) {
            path = await installer.install();
        }
        const tool = tl.tool(path);
        const pathToBakedManifest = this.getTemplatePath();
        tool.arg(['convert', '-f', dockerComposeFilePath, '-o', pathToBakedManifest]);
        const result = tool.execSync();
        if (result.code !== 0 || result.error) {
            throw result.error;
        }
        tl.debug(result.stdout);
        this.updateImages(pathToBakedManifest);
        tl.setVariable('manifestsBundle', pathToBakedManifest);
    }
}

class KustomizeRenderEngine extends RenderEngine {
    public bake = async () => {
        const kubectlPath = await utils.getKubectl();
        this.validateKustomize(kubectlPath);
        const command = tl.tool(kubectlPath);
        console.log(`[command] ${kubectlPath} kustomize ${tl.getPathInput('kustomizationPath')}`);
        command.arg(['kustomize', tl.getPathInput('kustomizationPath')]);

        const result = command.execSync({ silent: true } as IExecOptions);
        if (result.stderr) {
            tl.setResult(tl.TaskResult.Failed, result.stderr);
            return;
        }
        tl.debug(result.stdout);
        const pathToBakedManifest = this.getTemplatePath();
        fs.writeFileSync(pathToBakedManifest, result.stdout);
        this.updateImages(pathToBakedManifest);
        tl.setVariable('manifestsBundle', pathToBakedManifest);
    };

    private validateKustomize(kubectlPath: string) {
        const command = tl.tool(kubectlPath);
        command.arg(['version', '--client=true', '-o', 'json']);
        const result = command.execSync();
        if (result.code !== 0) {
            throw result.error;
        }
        const clientVersion = JSON.parse(result.stdout).clientVersion;
        if (clientVersion && parseInt(clientVersion.major) >= 1 && parseInt(clientVersion.minor) >= 14) {
            // Do nothing
        } else {
            throw new Error(tl.loc('KubectlShouldBeUpgraded'));
        }
    }
}

export async function bake(ignoreSslErrors?: boolean) {
    const renderType = tl.getInput('renderType', true);
    let renderEngine: RenderEngine;
    switch (renderType) {
        case 'helm':
        case 'helm2':
            renderEngine = new HelmRenderEngine();
            break;
        case 'kompose':
            renderEngine = new KomposeRenderEngine();
            break;
        case 'kustomize':
            renderEngine = new KustomizeRenderEngine();
            break;
        default:
            throw Error(tl.loc('UnknownRenderType'));
    }
    await renderEngine.bake();
}
