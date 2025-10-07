import * as Q from 'q';
import * as fs from 'fs';
import * as path from 'path'
import * as tl from 'azure-pipelines-task-lib/task';
import {JenkinsJobDetails} from "./JenkinsRestClient"

export abstract class ArtifactDetailsDownloaderBase {
    protected WriteContentToFileAndUploadAsAttachment(content: string, filePath: string): Q.Promise<any> {
        let defer = Q.defer<void>();

        // ensure it has .json extension
        if (path.extname(filePath) !== ".json") {
            filePath = `${filePath}.json`;
        }

        fs.writeFile(filePath, content, (err) => {
            if (err) {
                console.log(tl.loc("CouldNotWriteToFile", err));
                defer.reject(err);
                return;
            }

            console.log(tl.loc("UploadingAttachment", filePath));
            console.log(`##vso[task.uploadfile]${filePath}`);
            defer.resolve(null);
        });

        return defer.promise;
    }

    public abstract DownloadFromSingleBuildAndSave(jenkinsJobDetails: JenkinsJobDetails): Q.Promise<string>;
    public abstract DownloadFromBuildRangeAndSave(jenkinsJobDetails: JenkinsJobDetails, startIndex: number, endIndex: number): Q.Promise<string>;
}
