import tl = require('vsts-task-lib/task');
import fs = require('fs');

export function generateWebConfigFile(webConfigTargetPath: string, webConfigTemplatePath: string, substitutionParameters: any) {
    var webConfigContent: string = fs.readFileSync(webConfigTemplatePath, 'utf8');
    webConfigContent = replaceMultiple(webConfigContent, substitutionParameters);
    tl.writeFile(webConfigTargetPath, webConfigContent, { encoding: "utf8" });
}

function replaceMultiple(text: string, substitutions: any): string{
    for(var key in substitutions){
        text = text.replace(new RegExp('{' + key + '}', 'g'), substitutions[key].value);
    }
    return text;
}
