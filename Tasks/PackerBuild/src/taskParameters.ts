"use strict";

import * as tl from "vsts-task-lib/task";
import * as constants from "./constants";

export default class TaskParameters {
    public serviceEndpoint: string;

    public resourceGroup: string;
    public location: string;
    public storageAccount: string;

    public baseImage: string;
    public imagePublisher: string;
    public imageOffer: string;
    public imageSku: string;
    public osType: string;

    public packagePath: string;
    public deployScriptPath: string;

    constructor() {
        try {
            this.serviceEndpoint = tl.getInput(constants.ConnectedServiceInputName, true);
            this.resourceGroup = tl.getInput(constants.ResourceGroupInputName, true);
            this.storageAccount = tl.getInput(constants.StorageAccountInputName, true);
            this.location = tl.getInput(constants.LocationInputName, true);

            this.baseImage = tl.getInput(constants.BaseImageInputName, true);
            this._extractImageDetails();

            this.deployScriptPath = tl.getInput(constants.DeployScriptPathInputName, true);
            this.packagePath = tl.getInput(constants.DeployPackageInputName, true);
        } 
        catch (error) {
            throw (tl.loc("TaskParametersConstructorFailed", error.message));
        }
    }

    // extract image details from base image e.g. "MicrosoftWindowsServer:WindowsServer:2012-R2-Datacenter:windows"
    private _extractImageDetails() {
        var parts = this.baseImage.split(':');
        this.imagePublisher = parts[0];
        this.imageOffer = parts[1];
        this.imageSku = parts[2];
        this.osType = parts[3];
    }
}