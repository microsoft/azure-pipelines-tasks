"use strict";
import * as tl from "azure-pipelines-task-lib/task";
import * as fs from 'fs';

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

export function getBaseImageNameFromDockerFile(dockerFilePath: string): string {
    const dockerFileContent = fs.readFileSync(dockerFilePath, 'utf-8').toString();
    return getBaseImageName(dockerFileContent);
}

export function getBaseImageName(contents: string): string {
    var lines = contents.split(/[\r?\n]/);
    var i;
    for (i = 0; i < lines.length; i++) {
        var index = lines[i].toUpperCase().indexOf("FROM");
        if (index != -1) {
            var rest = lines[i].substring(index + 4);
            var imageName = rest.trim();
            return imageName;
        }
    }
    
    return null;
}

export function getResourceName(image: string, digest: string) {
    var match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/);
    if (!match) {
        return null;
    }

    var registry = match[1];
    var namespace = match[2];
    var repository = match[3];
    var tag = match[4];
  
    if (!namespace && registry && !/[:.]/.test(registry)) {
      namespace = registry
      registry = 'docker.io'
    }

    if (!namespace && !registry) {
      registry = 'docker.io'
      namespace = 'library'
    }

    registry = registry ? registry + '/' : '';
    namespace = namespace ? namespace + '/' : '';
    
    return "https://" + registry  + namespace  + repository + "@sha256:" + digest;
  }