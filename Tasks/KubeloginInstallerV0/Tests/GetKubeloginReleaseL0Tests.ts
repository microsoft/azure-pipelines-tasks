import { getKubeloginRelease } from "../utils";

const fs = require('fs')
import assert = require('assert');

import { TestString } from "./TestStrings";

export class GetKubeloginReleaseL0Tests {

    public static async startTests() {
        await this.validateGetKubeloginRelease2_1_6();
        await this.validateGetKubeloginReleasev2_1_6();
        await this.validateGetKubeloginReleaseLatestVersion();
    }

    public static async validateGetKubeloginRelease2_1_6() 
    {
        const release = getKubeloginRelease('2.1.6', 'darwin-amd64');
    }
    
    public static async validateGetKubeloginReleasev2_1_6() 
    {
        const release = getKubeloginRelease('v2.1.6', 'darwin-amd64');
    }

    public static async validateGetKubeloginReleaseLatestVersion() 
    {
        const release = getKubeloginRelease('latest', 'darwin-amd64');
    }
}

GetKubeloginReleaseL0Tests.startTests();