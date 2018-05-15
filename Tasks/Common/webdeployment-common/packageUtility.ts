import tl = require('vsts-task-lib/task');
import utility = require('./utility');
var zipUtility = require('webdeployment-common/ziputility.js');

export class PackageUtility {
    public static getPackagePath(packagePath: string): string {
        var availablePackages: string[] = utility.findfiles(packagePath);
        if(availablePackages.length == 0) {
            throw new Error(tl.loc('Nopackagefoundwithspecifiedpattern', packagePath));
        }

        if(availablePackages.length > 1) {
            throw new Error(tl.loc('MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpattern', packagePath));
        }

        return availablePackages[0];
    }
}

export class Package {
    constructor(packagePath: string) {
        this._path = PackageUtility.getPackagePath(packagePath);
        console.log(this._path);
        this._isMSBuildPackage = undefined;
        this._isFolder = undefined;
    }

    public getPath(): string {
        return this._path;
    }

    public async isMSBuildPackage(): Promise<boolean> {
        if(this._isMSBuildPackage == undefined) {
            this._isMSBuildPackage = false;
            if(!this.isFolder()) {
                var pacakgeComponent = await zipUtility.getArchivedEntries(this._path);
                if (((pacakgeComponent["entries"].indexOf("parameters.xml") > -1) || (pacakgeComponent["entries"].indexOf("Parameters.xml") > -1)) && 
                    ((pacakgeComponent["entries"].indexOf("systemInfo.xml") > -1) || (pacakgeComponent["entries"].indexOf("systeminfo.xml") > -1)
                    || (pacakgeComponent["entries"].indexOf("SystemInfo.xml") > -1))) {
                    this._isMSBuildPackage = true;
                }
            }
            
            tl.debug("Is the package an msdeploy package : " + this._isMSBuildPackage);
        }

        return this._isMSBuildPackage;
    }

    public isFolder(): boolean {
        if(this._isFolder == undefined) {
            if (!tl.exist(this._path)) {
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this._path));
            }

            this._isFolder = !tl.stats(this._path).isFile();
        }

        return this._isFolder;
    }
    
    private _path: string;
    private _isMSBuildPackage?: boolean;
    private _isFolder?: boolean;
}