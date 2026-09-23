import { Action } from "../operations/Action";
import { Utility } from "../operations/Utility";

export class ActionL0Tests {

    public static async startTests() {
        await this.validateCreateReleaseAction();
        await this.validateCreateReleaseActionWithMakeLatestTrue();
        await this.validateCreateReleaseActionWithMakeLatestLegacy();
        await this.validateEditReleaseAction();
        await this.validateEditReleaseActionWithMakeLatestTrue();
        await this.validateEditReleaseActionWithMakeLatestLegacy();
        await this.validateDeleteReleaseAction();
        await this.validateAssetPathLogging();
    }

    public static async validateCreateReleaseAction() {
        await new Action().createReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, [], "false");
    }

    public static async validateCreateReleaseActionWithMakeLatestTrue() {
        await new Action().createReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, [], "true");
    }

    public static async validateCreateReleaseActionWithMakeLatestLegacy() {
        await new Action().createReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, [], "legacy");
    }

    public static async validateEditReleaseAction() {
        await new Action().editReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, [], "id", "false");
    }

    public static async validateEditReleaseActionWithMakeLatestTrue() {
        await new Action().editReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, [], "id", "true");
    }

    public static async validateEditReleaseActionWithMakeLatestLegacy() {
        await new Action().editReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, [], "id", "legacy");
    }

    public static async validateDeleteReleaseAction() {
        await new Action().deleteReleaseAction("endpoint", "repo", "tag");
    }

    public static async validateAssetPathLogging() {
        const injectedAssetPath = [
            "release-assets/ordinary-prefix",
            "##vso[task.setvariable variable=PATH]attacker-bin",
            "##vso[task.complete result=Succeeded;done=true;]/asset.bin"
        ].join("\n");
        const originalGetUploadAssets = Utility.getUploadAssets;
        const originalIsPatternADirectory = Utility.isPatternADirectory;
        const originalIsFile = Utility.isFile;
        const originalValidateUploadAssets = Utility.validateUploadAssets;

        Utility.getUploadAssets = () => [injectedAssetPath];
        Utility.isPatternADirectory = () => false;
        Utility.isFile = () => true;
        Utility.validateUploadAssets = () => { };

        try {
            await (new Action() as any)._uploadAssetsForGivenPattern(
                "endpoint",
                "repo",
                "upload-url",
                [],
                "release-assets/**",
                "replace"
            );
        } finally {
            Utility.getUploadAssets = originalGetUploadAssets;
            Utility.isPatternADirectory = originalIsPatternADirectory;
            Utility.isFile = originalIsFile;
            Utility.validateUploadAssets = originalValidateUploadAssets;
        }
    }
}

ActionL0Tests.startTests();