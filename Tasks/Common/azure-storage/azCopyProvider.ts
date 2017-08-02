import * as path from "path";
import * as tl from 'vsts-task-lib/task';
import * as definitions from "./definitions";

export class AzCopyWindows implements definitions.IBlobTransferService {
    public async uploadBlobs(source: string, destUrl: string, accessKey: string){
        let azcopy = AzCopyWindowsTool.getAzCopyTool();
        azcopy.arg("/Source:" + source);
        azcopy.arg("/Dest:" + destUrl);
        azcopy.arg("/DestKey:" + accessKey);
        azcopy.arg("/S");
        azcopy.arg("/Y");
        await azcopy.exec();
    }
}

export class AzCopyXplat implements definitions.IBlobTransferService {
    public async uploadBlobs(source: string, destUrl: string, accessKey: string){
        let azcopy = AzCopyXplatTool.getAzCopyTool();
        azcopy.arg("");
        await azcopy.exec();
    }
}

class AzCopyWindowsTool {
    private static  _azCopyExePath;
    public static getAzCopyTool() {
        if(!AzCopyWindowsTool._azCopyExePath) {
            AzCopyWindowsTool._azCopyExePath = path.join(__dirname, "AzCopyWindows", "AzCopy", "AzCopy.exe");
        }

        return tl.tool(AzCopyWindowsTool._azCopyExePath);
    }
}

class AzCopyXplatTool {
    private static  _azCopyExePath;
    public static getAzCopyTool() {
        if(!AzCopyXplatTool._azCopyExePath) {

            // TODO: install .NetCore 1.1 runtime

            AzCopyXplatTool._azCopyExePath = path.join(__dirname, "AzCopyXplat", "AzCopy", "AzCopy");
        }

        return tl.tool(AzCopyXplatTool._azCopyExePath);
    }
}