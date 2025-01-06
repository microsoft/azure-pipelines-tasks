"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from "fs";
import ContainerConnection from "azure-pipelines-tasks-docker-common/containerconnection";
import * as sourceUtils from "azure-pipelines-tasks-docker-common/sourceutils";
import * as imageUtils from "azure-pipelines-tasks-docker-common/containerimageutils";
import * as fileutils from "azure-pipelines-tasks-docker-common/fileutils";
import * as path from "path";
import * as os from "os";

export function getImageNames(): string[] {
    let imageNamesFilePath = tl.getPathInput("imageNamesPath", /* required */ true, /* check exists */ true);
    var enforceDockerNamingConvention = tl.getBoolInput("enforceDockerNamingConvention");
    let imageNames = fs.readFileSync(imageNamesFilePath, "utf-8").trim().replace(/\r\n|\r/gm, "\n").split("\n"); // \r\n windows and \r  mac new line chars
    if (!imageNames.length) {
        throw new Error(tl.loc("NoImagesInImageNamesFile", imageNamesFilePath));
    }

    return imageNames.map(n => (enforceDockerNamingConvention === true)? imageUtils.generateValidImageName(n): n);
}

export function getImageName(): string {
    var enforceDockerNamingConvention = tl.getBoolInput("enforceDockerNamingConvention"); 
    var imageName = tl.getInput("imageName", true);
    if(enforceDockerNamingConvention === true) {
        return imageUtils.generateValidImageName(imageName);
    }

    return imageName;
}

export function getImageMappings(connection: ContainerConnection, imageNames: string[]): ImageMapping[] {
    let qualifyImageName = tl.getBoolInput("qualifyImageName");
    let imageInfos: ImageInfo[] = imageNames.map(imageName => {
        let qualifiedImageName = qualifyImageName ? connection.getQualifiedImageNameIfRequired(imageName) : imageName;
        return {
            sourceImageName: imageName,
            qualifiedImageName: qualifiedImageName,
            baseImageName: imageUtils.imageNameWithoutTag(qualifiedImageName),
            taggedImages: []
        };
    });

    let additionalImageTags = tl.getDelimitedInput("additionalImageTags", "\n");
    let includeSourceTags = tl.getBoolInput("includeSourceTags");
    let includeLatestTag = tl.getBoolInput("includeLatestTag");

    let sourceTags: string[] = [];
    if (includeSourceTags) {
        sourceTags = sourceUtils.getSourceTags();
    }

    let commonTags: string[] = additionalImageTags.concat(sourceTags);

    // For each of the image names, generate a mapping from the source image name to the target image.  The same source image name
    // may be listed more than once if there are multiple tags.  The target image names will be tagged based on the task configuration.
    for (let i = 0; i < imageInfos.length; i++) {
        let imageInfo = imageInfos[i];
        let imageSpecificTags: string[] = [];
        if (imageInfo.baseImageName === imageInfo.qualifiedImageName) {
            imageSpecificTags.push("latest");
        } else {
            imageInfo.taggedImages.push(imageInfo.qualifiedImageName);
            if (includeLatestTag) {
                imageSpecificTags.push("latest");
            }
        }

        commonTags.concat(imageSpecificTags).forEach(tag => {
            imageInfo.taggedImages.push(imageInfo.baseImageName + ":" + tag);
        });
    }

    // Flatten the image infos into a mapping between the source images and each of their tagged target images
    let sourceToTargetMapping: ImageMapping[] = [];
    imageInfos.forEach(imageInfo => {
        imageInfo.taggedImages.forEach(taggedImage => {
            sourceToTargetMapping.push({
                sourceImageName: imageInfo.sourceImageName,
                targetImageName: taggedImage
            });
        });
    });

    return sourceToTargetMapping;
}


function getTaskOutputDir(command: string): string {
    let tempDirectory = tl.getVariable('agent.tempDirectory') || os.tmpdir();
    let taskOutputDir = path.join(tempDirectory, "task_outputs");
    return taskOutputDir;
}

export function writeTaskOutput(commandName: string, output: string): string {
    let taskOutputDir = getTaskOutputDir(commandName);
    if (!fs.existsSync(taskOutputDir)) {
        fs.mkdirSync(taskOutputDir);
    }

    let outputFileName = commandName + "_" + Date.now() + ".txt";
    let taskOutputPath = path.join(taskOutputDir, outputFileName);
    if (fileutils.writeFileSync(taskOutputPath, output) == 0) {
        tl.warning(tl.loc('NoDataWrittenOnFile', taskOutputPath));
    }
    
    return taskOutputPath;
}

interface ImageInfo {
    /**
     * The original, unmodified, image name provided as input to the task
     */
    sourceImageName: string;

    /**
     * The source image name, qualified with the connection endpoint if configured to do so.
     */
    qualifiedImageName: string;

    /**
     * The qualified image name with any tagging removed.
     */
    baseImageName: string;

    /**
     * The collection of qualifed and tagged images associated with the source image.
     */
    taggedImages: string[];
}

export interface ImageMapping {
    sourceImageName: string;
    targetImageName: string;
}