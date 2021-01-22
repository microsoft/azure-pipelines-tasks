export class DeploymentParameters {
    public properties: Object;
    public location: string;

    constructor(properties: Object, location?: string) {
        this.properties = properties;
        this.location = location;
    }
    public updateCommonProperties(mode: string) {
        this.properties["mode"] = mode;
    }
}
