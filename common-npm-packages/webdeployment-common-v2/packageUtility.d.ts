export declare enum PackageType {
    war = 0,
    zip = 1,
    jar = 2,
    folder = 3
}
export declare class PackageUtility {
    static getPackagePath(packagePath: string): string;
    static getArtifactAlias(packagePath: string): string;
}
export declare class Package {
    constructor(packagePath: string);
    getPath(): string;
    isMSBuildPackage(): Promise<boolean>;
    getPackageType(): PackageType;
    isFolder(): boolean;
    private _isFolder?;
    private _path;
    private _isMSBuildPackage?;
    private _packageType?;
}
