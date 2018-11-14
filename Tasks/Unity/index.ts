import path = require('path');
import t1 = require('vsts-task-lib/task');
    
async function run() {
    
    t1.setResourcePath(path.join(__dirname, 'task.json'));

    var executeMethod = t1.getInput('buildFunction');
    var gamePath = t1.getPathInput('gameDirectory');
    var unityPath = "C:/Program Files/Unity/Editor/Unity.exe";

    var customBuild = t1.getInput('customBuild');
    if(customBuild == "Yes") {
        t1.execSync(unityPath, "-batchmode -projectPath " + gamePath + " -executeMethod " + executeMethod + " -stackTraceLogType Full -quit");
    } else {
        var buildPlatform = t1.getInput('buildPlatform');
        var buildArg = "win64";
        switch(buildPlatform) {
            default: break;
            case "Win32": buildArg = "-buildWindowsPlayer"; break;
            case "Win64": buildArg = "-buildWindows64Player"; break;
            case "OSX32": buildArg = "-buildOSXPlayer"; break;
            case "OSX64": buildArg = "-buildOSX64Player"; break;
            case "Linux32": buildArg = "-buildLinux32Player"; break;
            case "Linux64": buildArg = "-buildLinux64Player"; break;
            case "LinuxU": buildArg = "-buildLinuxUniversalPlayer"; break;
        }  
        t1.execSync(unityPath, "-batchmode -projectPath " + gamePath + " " + buildArg + " " + gamePath + " -stackTraceLogType Full -quit");
    }
}


run();