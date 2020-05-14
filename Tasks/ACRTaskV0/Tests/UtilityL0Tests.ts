import { TaskUtil } from "../utilities/utils";
import { AcrTask } from "../models/acrtaskparameters"
import { TestString } from './TestStrings';

export class UtilityL0Tests {

    public static startTests() {
        var acrTask = new AcrTask();
        acrTask.tags = ["v1"];
        acrTask.repository = "usercr.azurecr.io/user/somerepo"
        acrTask.dockerFile = "Dockerfile"

        this.validateGetResourceGroupNameFromUrl();
        this.validateGetListOfTagValuesForImageNames(acrTask);
        this.validateGetImageNamesForGit(acrTask);
        this.validateGetImageNamesForFile(acrTask);
        this.validateCreateBuildCommand(acrTask);
    }

    public static validateGetResourceGroupNameFromUrl() {
        var id  = "//subscriptions/resourceGroups/someResourceGroup/providers/Microsoft.ContainerRegistry/registries/usercr"
        const expectedResourceGroup = "someResourceGroup";
        const resourceGroup = TaskUtil.getResourceGroupNameFromUrl(id);
        
        if(resourceGroup == expectedResourceGroup) 
        {
            console.log(TestString.getResourceGroupNameFromUrlKeyword);
        }
    }

    public static validateGetListOfTagValuesForImageNames(acrTask: AcrTask) {
        const expectedRunTag = "Tag0";
        const expectedRunValue = "v1"
        const runValues = TaskUtil.getListOfTagValuesForImageNames(acrTask);
        if(runValues[0].name == expectedRunTag &&  runValues[0].value == expectedRunValue)
        {
            console.log(TestString.getListOfTagValuesForImageNamesKeyword);
        }
    }

    public static validateGetImageNamesForGit(acrTask: AcrTask) {
        acrTask.contextType = "git";
        const expectedImageNameWithTag = "usercr.azurecr.io/user/somerepo:v1";
        const imageNames = TaskUtil.getImageNames(acrTask);
        if(imageNames[0] == expectedImageNameWithTag)
        {
            console.log(TestString.getImageNamesForGitKeyword);
        }
    }

    public static validateGetImageNamesForFile(acrTask: AcrTask) {
        acrTask.contextType = "file";
        const expectedImageNameWithTag = "usercr.azurecr.io/user/somerepo:{{.Values.Tag0}}";
        const imageNames = TaskUtil.getImageNames(acrTask);
        if(imageNames[0] == expectedImageNameWithTag)
        {
            console.log(TestString.getImageNamesForFileKeyword);
        }
    }

    public static validateCreateBuildCommand(acrTask: AcrTask) {
        acrTask.contextType = "git";
        const expectedBuildString = "-t usercr.azurecr.io/user/somerepo:v1 --label \"com.visualstudio.abc.image.system.teamfoundationcollectionuri=https://abc.visualstudio.com/\" --label \"com.visualstudio.abc.image.build.sourceversion=123abc\" -f Dockerfile .";
        const buildString = TaskUtil.createBuildCommand(acrTask);
        if(buildString == expectedBuildString)
        {
            console.log(TestString.createBuildCommandKeyWord);
        }
    }
}

UtilityL0Tests.startTests();