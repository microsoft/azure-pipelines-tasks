export class VSTestVersion {

    constructor(public vstestExeLocation: string, public majorVersion: number, public minorversion: number, public patchNumber: number) {
    }

    public isTestImpactSupported(): boolean {
        return (this.majorVersion >= 15);
    }

    public isResponseFileSupported(): boolean {
        return (this.majorVersion >= 15);
    }

    public vstestDiagSupported(): boolean {
        return (this.majorVersion >= 15);
    }

    public isPrivateDataCollectorNeededForTIA(): boolean {
        return false;
    }

    public isRunInParallelSupported(): boolean {
        return (this.majorVersion >= 15);
    }

    public isTestSettingsPropertiesSupported(): boolean {
        return (this.majorVersion > 15) || (this.majorVersion === 15) && (this.patchNumber > 26906);
    }
}

export class Dev14VSTestVersion extends VSTestVersion {
    constructor(runnerLocation: string, minorVersion: number, patchNumber: number) {
        super(runnerLocation, 14, minorVersion, patchNumber);
    }

    public isTestImpactSupported(): boolean {
        return (this.patchNumber >= 25420);
    }

    public isResponseFileSupported(): boolean {
        return (this.patchNumber >= 25420);
    }

    public isRunInParallelSupported(): boolean {
        return (this.patchNumber >= 25420);
    }

    public isPrivateDataCollectorNeededForTIA(): boolean {
        return true;
    }
}

export class Dev15VSTestVersion extends VSTestVersion {
    constructor(runnerLocation: string, minorVersion: number, patchNumber: number) {
        super(runnerLocation, 15, minorVersion, patchNumber);
    }

    public isTestImpactSupported(): boolean {
        return (this.patchNumber >= 25727);
    }

    public isResponseFileSupported(): boolean {
        return (this.patchNumber >= 25420);
    }

    public vstestDiagSupported(): boolean {
        return (this.patchNumber > 25428);
    }
}