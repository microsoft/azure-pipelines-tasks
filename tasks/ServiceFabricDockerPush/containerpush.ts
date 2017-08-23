"use strict";

import * as fs from "fs";
import * as path from "path";
import * as xml2js from "xml2js";
import * as str from "string";
import * as tl from "vsts-task-lib/task";
import ContainerConnection from "docker-common/containerconnection";
import * as sourceUtils from "docker-common/sourceutils";
import * as imageUtils from "docker-common/containerimageutils";
import * as Q from 'q';

let stripbom = require('strip-bom');

/**
 * Executes the workflow of the task by tagging images, pushing them to the registry, and updating service manifests appropriately.
 * @param connection 
 */
export function run(connection: ContainerConnection): Q.Promise<void> {
    
    let imageNamesPath = tl.getPathInput("imageNamesPath", /*required*/ true, /*check exists*/ true);
    let applicationPackagePath = tl.getPathInput("applicationPackagePath", /*required*/ true, /*check exists*/ true);

    let imageNamesFromFile = fs.readFileSync(imageNamesPath, "utf-8").trim().replace('\r\n', '\n').split('\n');

    if (!imageNamesFromFile.length) {
        return <Q.Promise<void>><any>Q.resolve(null);
    }

    validateInputImageNames(imageNamesFromFile);

    let taggedImages = getTaggedImageList(connection, imageNamesFromFile);

    // The images need to be qualified and tagged appropriately in order to be pushed.
    // Generate a chain of promises that tag the necessary Docker images appropriately
    let tagDockerImagesPromise = taggedImages
        .reduce((tagPromise: Q.Promise<void>, imageInfo) => {
            return tagPromise.then(() => {
                return dockerTag(connection, imageInfo.originalName, imageInfo.taggedName);
        });
    }, <Q.Promise<void>><any>Q.resolve(null));

    // Wait for the Docker images to be tagged
    let runPromise = tagDockerImagesPromise.then(() => {

        // The index of each image digest corresponds to the same index within the taggedImages array.
        let imageDigests: string[] = [];
        
        // Generate a chain of promises that sequentially push the docker images
        let pushDockerImagesPromise = taggedImages.reduce((pushPromise: Q.Promise<void[]>, image) => {
            return pushPromise.then(() => {
                return dockerPush(connection, image.taggedName).then(imageDigest => imageDigests.push(imageDigest));
            });
        }, Q.resolve(null));
        
        // Wait for the Docker images to be pushed to the registry and then update the service manifests.
        return pushDockerImagesPromise.then(() => {
            return updateServiceManifests(taggedImages, imageDigests, applicationPackagePath);
        });
    });

    return <Q.Promise<void>><any>runPromise;
}

/**
 * Asynchronously updates the service manifest files so that they reference the image digests associated with the pushed images.
 * @param taggedImages Full set of images that have been pushed.
 * @param imageDigests Image digest values for each of the images that have been pushed.
 * @param applicationPackagePath Path to the Service Fabric application package.
 */
function updateServiceManifests(taggedImages: ImageNameInfo[], imageDigests: string[], applicationPackagePath: string): Q.Promise<void[]> {
    let serviceManifestPaths = fs.readdirSync(applicationPackagePath)
        .filter(f => fs.statSync(path.join(applicationPackagePath, f)).isDirectory())
        .map(d => path.join(applicationPackagePath, d, "ServiceManifest.xml"));

    // The index of each service manifest corresponds to the same index within the serviceManifestPaths array.
    let serviceManifests = [];

    // Generate a chain of promises that sequentially read the service manifest files
    let readServiceManifestsPromise = serviceManifestPaths.reduce((readManifestPromise: Q.Promise<any>, serviceManifestPath) => {
        return readManifestPromise.then(() => {
            return readXmlFileAsJson(serviceManifestPath).then(json => serviceManifests.push(json) );
        });
    }, Q.resolve(null));

    let serviceManifestSavePromises: Q.Promise<void>[] = [];

    // Wait for the service manifest files to be read
    return readServiceManifestsPromise.then(() => {
        let imageNameToServiceManifestMapping = getImageNameToServiceManifestInfoMapping(serviceManifests, serviceManifestPaths);

        // Go through each of the images that were pushed and find those that were tagged with latest.
        for (let imageIndex = 0; imageIndex < taggedImages.length; imageIndex++) {
            let image = taggedImages[imageIndex];
            if (!image.hasLatestTag) {
                continue;
            }

            // Find the service manifest which is configured to use this image
            let serviceManifestImageNameInfo = imageNameToServiceManifestMapping[image.originalName];
            if (serviceManifestImageNameInfo) {
                let newImageName = `${image.taggedName}@${imageDigests[imageIndex]}`;

                tl.debug(`Changing image name from ${image.originalName} to ${newImageName} for service manifest ${serviceManifestImageNameInfo.serviceManifest.ServiceManifest.$.Name}.`);
                
                // Update the image name in the service manifest to use the image digest value instead.
                serviceManifestImageNameInfo.imageNameElement[0] = newImageName;

                serviceManifestSavePromises.push(writeJsonAsXmlFile(serviceManifestImageNameInfo.serviceManifestPath, serviceManifestImageNameInfo.serviceManifest));
            }
        }

        return Q.all(serviceManifestSavePromises);
    });
}

/**
 * Validates the set of image names that were provided as input to the task.
 * @param imageNames The image names to validate.
 */
function validateInputImageNames(imageNames: string[]) {
    imageNames.forEach(imageName => {
        // If the image is qualified with a registry or is tagged, we don't support that.
        if (imageUtils.hasRegistryComponent(imageName) || imageUtils.imageNameWithoutTag(imageName) !== imageName) {
            throw new Error(tl.loc('InvalidImageName', imageName));
        }
    });
}

/**
 * Asynchronously pushes a Docker image to a registry.
 * @param connection Connection to the Docker host and registry.
 * @param imageName Name of the image to push.
 * @returns A promise whose result is the image digest value of the image that was pushed.
 */
function dockerPush(connection: ContainerConnection, imageName: string): Q.Promise<string> {
    let command = connection.createCommand();
    command.arg("push");
    command.arg(imageName);

    let output = "";
    command.on("stdout", data => {
        output += data;
    });

    tl.debug(`Pushing image ${imageName}.`);

    return connection.execCommand(command).then(() => {
        // Parse the output to find the repository digest
        let imageDigest = output.match(/^[^:]*: digest: ([^ ]*) size: \d*$/m)[1];
        return imageDigest;
    });
}

/**
 * Asynchronously tags a Docker image.
 * @param connection Connection to the Docker host and registry.
 * @param sourceImage Name of the source image.
 * @param targetImage Name of the target image.
 */
function dockerTag(connection: ContainerConnection, sourceImage: string, targetImage: string): Q.Promise<void> {
    let command = connection.createCommand();
    command.arg("tag");
    command.arg(sourceImage);
    command.arg(targetImage);

    tl.debug(`Tagging image ${sourceImage} with ${targetImage}.`);

    return connection.execCommand(command);
}

/**
 * Reads an XML file and asynchronously converts its content to JSON.
 * @param filePath Path to the XML file.
 */
function readXmlFileAsJson(filePath: string): Q.Promise<any> {
    return convertXmlStringToJson(fs.readFileSync(filePath, "utf-8"));
}

/**
 * Asynchronously converts an XML string into JSON.
 * @param xmlContent String containing XML content.
 */
function convertXmlStringToJson(xmlContent: string): Q.Promise<any> {
    return Q.nfcall<any>(xml2js.parseString, stripbom(xmlContent));
}

/**
 * Asynchronously converts a JSON object into XML and writes it to a file.
 * @param filePath Path to the XML file.
 * @param jsonContent JSON object to be converted.
 */
function writeJsonAsXmlFile(filePath: string, jsonContent: any): Q.Promise<void> {
    let builder = new xml2js.Builder({
        pretty: true,
        indent: ' ',
        newline: '\n',
        xmldec: {
            standalone: false
        }
    });
    let xml = builder.buildObject(jsonContent);
    xml = str(xml).replaceAll("&#xD;", "").s;
    return writeFile(filePath, xml);
}

/**
 * Asynchronously writes a string to a file.
 * @param filePath Path to the file.
 * @param fileContent String content to be written.
 */
function writeFile(filePath: string, fileContent: string): Q.Promise<void> {
    return Q.nfcall<void>(fs.writeFile, filePath, fileContent, { encoding: "utf-8" });
}

/**
 * Gets an expanded list of qualified and tagged images from the specified set of initial image names.
 * @param connection Connection to the Docker host and registry.
 * @param imageNameInfos Info about the image names.
 */
function getTaggedImageList(connection: ContainerConnection, imageNames: string[]): ImageNameInfo[] {
    let images: ImageNameInfo[] = [];

    // Include image names tagged with any custom tags specified in the task input.
    let additionalImageTags = tl.getDelimitedInput("additionalImageTags", "\n");
    let includeSourceTags = tl.getBoolInput("includeSourceTags");

    let sourceTags: string[] = [];
    if (includeSourceTags) {
        // Include image names tagged with SCC tags.
        sourceTags = sourceUtils.getSourceTags();
    }

    let allTags = ["latest"].concat(additionalImageTags).concat(sourceTags);

    for (let i = 0; i < imageNames.length; i++) {
        let originalImageName = imageNames[i];
        let qualifiedImageName = connection.qualifyImageName(originalImageName);

        allTags.forEach(tag => {
            images.push({
                originalName: originalImageName,
                taggedName: `${qualifiedImageName}:${tag}`,
                hasLatestTag: tag === "latest"
            });
        });
    }

    return images;
}

/**
 * Returns an object that maps image names with info about the service manifests that reference those image names.
 * @param serviceManifests Set of service manifests.
 * @param serviceManifestPaths Corresponding set of paths of each of the service manifests.
 */
function getImageNameToServiceManifestInfoMapping(serviceManifests: any[], serviceManifestPaths: string[]): ImageNameServiceManifestMap {
    let imageNameToServiceManifestMapping: ImageNameServiceManifestMap = {};
    // Find all service manifests which are configured to use a Docker image name and create a mapping between the image name
    // and the service manifest.
    for (let serviceManifestIndex = 0; serviceManifestIndex < serviceManifests.length; serviceManifestIndex++) {
        let serviceManifest = serviceManifests[serviceManifestIndex];

        let codePackage = serviceManifest.ServiceManifest.CodePackage.find(el => el.$.Name === 'Code');

        // If this service manifest references this image name
        if (codePackage &&
            codePackage.EntryPoint &&
            codePackage.EntryPoint[0].ContainerHost &&
            codePackage.EntryPoint[0].ContainerHost[0].ImageName) {

                imageNameToServiceManifestMapping[codePackage.EntryPoint[0].ContainerHost[0].ImageName[0]] = {
                    imageNameElement: codePackage.EntryPoint[0].ContainerHost[0].ImageName,
                    serviceManifest: serviceManifest,
                    serviceManifestPath: serviceManifestPaths[serviceManifestIndex]
                };
        }
    }

    return imageNameToServiceManifestMapping;
}

interface ImageNameServiceManifestMap {
    [imageName: string]: ServiceManifestImageNameInfo;
}

interface ServiceManifestImageNameInfo {
    imageNameElement: string[];
    serviceManifest: any;
    serviceManifestPath: string;
}

interface ImageNameInfo {
    originalName: string;
    taggedName: string;
    hasLatestTag?: boolean;
}