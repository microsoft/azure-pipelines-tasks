import path = require('path');
import t1 = require('vsts-task-lib/task');
    
async function run() {
    
    t1.setResourcePath(path.join(__dirname, 'task.json'));

    var executeMethod = t1.getInput('buildFunction');
    var gamePath = t1.getPathInput('gameDirectory');
    var unityPath = "C:/Program Files/Unity/Editor/Unity.exe";

    var customBuild = t1.getInput('customBuild');
    if(customBuild == "Yes") t1.execSync(unityPath, "-batchmode -projectPath " + gamePath + " -executeMethod " + executeMethod);
    else {
        var buildPlatform = t1.getInput('buildPlatform');
        var buildArg = "win64";
        switch(buildPlatform) {
            case "WinMetro": buildArg = "-buildWindowsPlayer"; break;
            case "IOS": buildArg = "-buildOSXPlayer"; break;
            case "Linux": buildArg = "-buildLinuxUniversalPlayer"; break;
        }  
        t1.execSync(unityPath, "-batchmode -projectPath " + gamePath + " " + buildArg + " " + gamePath + " -quit"); 
    }
}


run();