import { Action } from "../operations/Action";

export class ActionL0Tests {

    public static async startTests() {
        await this.validateCreateReleaseAction();
        await this.validateCreateReleaseActionWithMakeLatestTrue();
        await this.validateCreateReleaseActionWithMakeLatestLegacy();
        await this.validateEditReleaseAction();
        await this.validateEditReleaseActionWithMakeLatestTrue();
        await this.validateEditReleaseActionWithMakeLatestLegacy();
        await this.validateDeleteReleaseAction();
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
}

ActionL0Tests.startTests();