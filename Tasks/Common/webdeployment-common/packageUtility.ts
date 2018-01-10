import tl = require('vsts-task-lib/task');
import utility = require('./utility');

export class PackageUtility {
    public static getPackagePath(packagePath: string): string {
        var availablePackages: string[] = utility.findfiles(packagePath);
        if(availablePackages.length == 0) {
            throw new Error(tl.loc('Nopackagefoundwithspecifiedpattern'));
        }

        if(availablePackages.length > 1) {
            throw new Error(tl.loc('MorethanonepackagematchedwithspecifiedpatternPleaserestrainthesearchpattern'));
        }

        return availablePackages[0];
    }
}

