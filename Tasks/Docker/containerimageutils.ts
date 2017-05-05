"use strict";
import * as tl from "vsts-task-lib/task";

export function hasRegistryComponent(imageName: string): boolean {
    var periodIndex = imageName.indexOf("."),
        colonIndex = imageName.indexOf(":"),
        slashIndex = imageName.indexOf("/");
    return ((periodIndex > 0 && periodIndex < slashIndex) ||
            (colonIndex > 0 && colonIndex < slashIndex));
}

export function imageNameWithoutTag(imageName: string): string {
    var endIndex = 0;
    if (hasRegistryComponent(imageName)) {
        // Contains a registry component that may include ":", so omit
        // this part of the name from the main delimiter determination
        endIndex = imageName.indexOf("/");
    }
    endIndex = imageName.indexOf(":", endIndex);
    return endIndex < 0 ? imageName : imageName.substr(0, endIndex);
}

export function changeDefaultImageNameToLowerCase(imageName: string): string {
    
    if(imageName === getDefaultImage())
    {
        return imageName.toLowerCase();
    }
    
    return imageName;
}

function getDefaultImage() : string {
    var repositoryName = tl.getVariable('build.repository.name');
    var buildId = tl.getVariable('build.buildId');

    return repositoryName + ":" + buildId;
}