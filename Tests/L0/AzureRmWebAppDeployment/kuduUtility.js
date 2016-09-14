function deployWebAppPackage(webAppPackage, virtualApplicationMappings, publishingProfile, virtualApplication) {
    console.log ('Deployed using KuduDeploy');
}
exports.deployWebAppPackage = deployWebAppPackage;

function archiveFolder(webAppPackage, webAppZipFile) {
   console.log ('Folder Archiving Successful');
}
exports.archiveFolder = archiveFolder;

function getVirtualAndPhysicalPaths(virtualApplication, virtualApplicationMappings) {
    // construct URL depending on virtualApplication or root of webapplication 
    var physicalPath = "/site/wwwroot";
    var virtualPath = "/";
    if (virtualApplication) {
        virtualPath = "/" + virtualApplication;
    }
    for (var index in virtualApplicationMappings) {
        var mapping = virtualApplicationMappings[index];
        if (mapping.virtualPath == virtualPath) {
            physicalPath = mapping.physicalPath;
            break;
        }
    }
    return [virtualPath, physicalPath];
}
exports.getVirtualAndPhysicalPaths = getVirtualAndPhysicalPaths;

