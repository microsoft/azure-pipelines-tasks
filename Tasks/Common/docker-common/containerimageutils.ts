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
    return generateValidImageName(endIndex < 0 ? imageName : imageName.substr(0, endIndex));
}

export function generateValidImageName(imageName: string): string {
    imageName = imageName.toLowerCase();
    imageName = imageName.replace(/ /g,"");
    return imageName;
}