var yaml = require('js-yaml');
var fs   = require('fs');
import tl = require('azure-pipelines-task-lib/task');

export function yamlVariableSubstitution(folderPath: string, yamlFiles) {
    let variableTree = createEnvTree(tl.getVariables());
    let isSubstitutionApplied: boolean = false;
    for(let yamlFile of yamlFiles) {
        console.log(tl.loc('JSONvariableSubstitution' , yamlFile));
        var matchFiles = utility.findfiles(path.join(folderPath, yamlFile));
        if(matchFiles.length === 0) {
            throw new Error(tl.loc('NoYAMLfilematchedwithspecificpattern', yamlFile));
        }
        for(let file of matchFiles) {
            let yamlObject;
            try {
                yamlObject = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
            } 
            catch(exception) {
                throw Error(tl.loc('JSONParseError', file, exception));
            }
            console.log(tl.loc('JSONvariableSubstitution' , file));
            isSubstitutionApplied = substituteVariables(yamlObject, variableTree) || isSubstitutionApplied;
            tl.writeFile(file, yaml.safeDump(yamlObject), 'utf8');
        }
    }
}