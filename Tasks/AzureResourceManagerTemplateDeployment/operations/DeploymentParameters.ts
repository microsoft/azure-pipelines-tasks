export class DeploymentParameters {
    public properties: Object;
    public location: string;

    constructor(properties: Object) {
        this.properties = properties;
    }
    public updateCommonProperties(mode: string) {
        this.properties["mode"] = mode;
        this.properties["debugSetting"] = { "detailLevel": "requestContent, responseContent" };
    }
    public updateLocation(location: string) {
        this.location = location;
    }
}
