import { Kubectl } from 'kubernetes-common-v2/kubectl-object-model';
import { isDeploymentEntity } from './KubernetesObjectUtility';
import * as fileHelper from './FileHelper';
import * as tl from 'azure-pipelines-task-lib';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export const DEPLOYMENT_STRATEGY = 'BLUEGREEN';

export async function deploy(kubectl: Kubectl, filePaths: string[]) {
    const ingresses = [];
    const services = [];
    const deploymentEntities = [];

    for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        const objects = await readYaml(filePath);
        objects.forEach(object => {
            if (object && object.kind) {
                if (object.kind.toUpperCase() === 'INGRESS') {
                    ingresses.push(object);
                } else if (object.kind.toUpperCase() === 'SERVICE') {
                    services.push(object);
                } else if (isDeploymentEntity(object.kind)) {
                    deploymentEntities.push(object);
                }
            }
        });
    }

    if (ingresses.length === 0) {
        throw new Error('Blue Green deployment is supported only when ingresses are provided');
    }

    const ingressesServices = [];
    ingresses.forEach(ingress => {
        ingress.spec.rules.forEach(rule => {
            Object.keys(rule).forEach(ruleKey => {
                const paths = rule[ruleKey].paths;
                if (paths) {
                    paths.forEach(path => {
                        const serviceName = path.backend.serviceName;
                        const s = services.find((service) => { return service.metadata.name.startsWith(serviceName); });
                        if (s) {
                            ingressesServices.push(s);
                        }
                    });
                }
            });
        });
    });

    const servicesDeployEntities = [];
    ingressesServices.forEach(service => {
        const selector = service.spec.selector;
        deploymentEntities.forEach(entity => {
            const labels = entity.metadata.labels;
            if (select(selector, labels)) {
                servicesDeployEntities.push(entity);
            }
        });
    });

    const objectsToDeploy = ingressesServices.concat(servicesDeployEntities);

    // Check if green exists

    // Add new Labels
    setBlueGreenProperties(objectsToDeploy, '24');

    // Write objects to new files
    // Deploy all objects
    const manifestFiles = fileHelper.writeObjectsToFile(objectsToDeploy);
    const result = kubectl.apply(manifestFiles);

    return { 'result': result, 'newFilePaths': manifestFiles };
}

function readYaml(filePath: string) {
    return new Promise<any>((resolve, reject) => {
        const fileContents = fs.readFileSync(filePath);
        try {
            const objs = [];
            yaml.safeLoadAll(fileContents, function (inputObject: any) {
                objs.push(inputObject);
            });
            resolve(objs);
        } catch (ex) {
            reject(ex);
        }
    });
}

function select(selector: { [key: string]: string }, labels: { [key: string]: string }) {
    return Object.keys(selector).every(key => {
        return selector[key] === labels[key];
    });
}

function setBlueGreenProperties(objects: any, version: string) {
    objects.forEach(object => {
        object.metadata.name = `${object.metadata.name}-${version}`;
        object.metadata.labels['azure-pipelines/version'] = version;

        if (object.spec.template) {
            object.spec.template.metadata.labels['azure-pipelines/version'] = version;
        }

        if (object.spec.selector) {
            if (object.spec.selector.matchLabels) {
                object.spec.selector.matchLabels['azure-pipelines/version'] = version;
            } else {
                object.spec.selector['azure-pipelines/version'] = version;
            }
        }
    });
}
