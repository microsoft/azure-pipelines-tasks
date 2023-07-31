import tl = require('azure-pipelines-task-lib/task');
import utility = require('./utility');
var zipUtility = require('./ziputility.js');
import path = require('path');

export enum PackageType {
    war,
    zip,
    jar,
    folder
}

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
        this._isMSBuildPackage = undefined;
    }

    public getPath(): string {
        return this._path;
    }

    public async isMSBuildPackage(): Promise<boolean> {
        if(this._isMSBuildPackage == undefined) {
            this._isMSBuildPackage = false;
            if(this.getPackageType() != PackageType.folder) {
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

    public getPackageType(): PackageType {
        if (this._packageType == undefined) {
            if (!tl.exist(this._path)) {
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this._path));
            } else{
                if (this._path.toLowerCase().endsWith('.war')) {
                    this._packageType = PackageType.war;
                    tl.debug("This is war package ");
                } else if(this._path.toLowerCase().endsWith('.jar')){
                    this._packageType = PackageType.jar;
                    tl.debug("This is jar package ");
                } else if (this._path.toLowerCase().endsWith('.zip')){
                    this._packageType = PackageType.zip;
                    tl.debug("This is zip package ");
                } else if(!tl.stats(this._path).isFile()){
                    this._packageType = PackageType.folder;
                    tl.debug("This is folder package ");
                }else{
                    throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this._path));
                }
            }
        }
        return this._packageType;
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
    
    private _isFolder?: boolean;
    private _path: string;
    private _isMSBuildPackage?: boolean;
    private _packageType?: PackageType;
}
