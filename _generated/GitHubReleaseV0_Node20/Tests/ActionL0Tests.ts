import { Action } from "../operations/Action";

export class ActionL0Tests {

    public static async startTests() {
        await this.validateCreateReleaseAction();
        await this.validateEditReleaseAction();
        await this.validateDeleteReleaseAction();
    }

    public static async validateCreateReleaseAction() {
        await new Action().createReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, []);
    }

    public static async validateEditReleaseAction() {
        await new Action().editReleaseAction("endpoint", "repo", "target", "tagName", "title", "note", false, false, [], "id");
    }

    public static async validateDeleteReleaseAction() {
        await new Action().deleteReleaseAction("endpoint", "repo", "tag");
    }

}

ActionL0Tests.startTests();