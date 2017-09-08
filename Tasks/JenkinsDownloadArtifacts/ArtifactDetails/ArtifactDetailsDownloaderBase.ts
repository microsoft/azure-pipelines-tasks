import * as Q from 'q';
import * as fs from 'fs';
import * as  tl from 'vsts-task-lib/task';

export abstract class ArtifactDetailsDownloaderBase {
    protected UploadAttachment(content: string, filePath: string): Q.Promise<any> {
        let defer = Q.defer<void>();

        fs.writeFile(filePath, content, (err) => {
            if (err) {
                console.log(`could not save the content to the file. Failed with an error ${err}`);
                defer.reject(err);
                return;
            }

            console.log(`uploading ${filePath} as attachment`);
            console.log(`##vso[task.uploadfile]${filePath}`);
            defer.resolve(null);
        });

        return defer.promise;
    }

    public abstract DownloadFromSingleBuildAndSave(job: string): Q.Promise<string>; //job is string here, it could a number or 'lastSuccessfulBuild'
    public abstract DownloadFromBuildRangeAndSave(startIndex: number, endIndex: number): Q.Promise<string>;
}
