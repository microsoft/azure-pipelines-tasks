var fs = require('fs');
import * as extract from 'extract-zip'
var path = require('path')

import * as corem from 'azure-devops-node-api/CoreApi';
import * as tl from 'azure-pipelines-task-lib/task';
import * as vsom from 'azure-devops-node-api/VsoClient';
import { getProjectAndFeedIdFromInputParam } from "azure-pipelines-tasks-packaging-common/util"
import stream = require('stream');
import { getConnection } from './connections';
import { WebApi } from 'azure-devops-node-api';

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function main(): Promise<void> {
	throw new Error(tl.loc("DeprecatedTask"));
}

export async function downloadPackage(feedConnection: WebApi, pkgsConnection: WebApi, feedId: string, packageId: string, version: string, downloadPath: string) {
	var feedsClient = feedConnection.vsoClient;
	var packagesClient = pkgsConnection.vsoClient;
	
	var packageUrl = await getNuGetPackageUrl(feedsClient, feedId, packageId);

	await new Promise<void>((resolve, reject) => {
		feedsClient.restClient.client.get(packageUrl).then(async response => {
			if (response.message.statusCode != 200) {
				return reject(tl.loc("FailedToGetPackageMetadata", response.message.statusMessage));
			}

			var result = JSON.parse(await response.readBody());
			var packageType = result.protocolType.toLowerCase();
			var packageName = result.name;

			if (packageType == "nuget") {
				
				var getDownloadUrlPromise = getDownloadUrl(packagesClient, feedId, packageName, version)
				getDownloadUrlPromise.catch((error) => {
					return reject(error)
				});
				var downloadUrl = await getDownloadUrlPromise;
				
				if (!tl.exist(downloadPath)) {
					tl.mkdirP(downloadPath);
				}

				var zipLocation = path.resolve(downloadPath, "../", packageName) + ".zip";
				var unzipLocation = path.join(downloadPath, "");

				console.log(tl.loc("StartingDownloadOfPackage", packageName, zipLocation));
				var packagesCoreApi = await pkgsConnection.getCoreApi();
				var downloadNugetPackagePromise = downloadNugetPackage(packagesCoreApi, downloadUrl, zipLocation);
				downloadNugetPackagePromise.catch((error) => {
					return reject(error)
				});
				await downloadNugetPackagePromise;

				console.log(tl.loc("ExtractingNugetPackage", packageName, unzipLocation));

				var unzipPromise = unzip(zipLocation, unzipLocation);
				unzipPromise.catch((error) => {
					return reject(error)
				});
				await unzipPromise;
				
				if (tl.exist(zipLocation)) {                        
					try {
						tl.rmRF(zipLocation);
					} catch (error) {
						tl.warning(tl.loc("OperationFailed", "rmRF", error));
					}
				}
				return resolve();
			}
			else {
				return reject(tl.loc("PackageTypeNotSupported"));
			}
		})
		.catch(error => { 
			return reject(tl.loc("FailedToGetPackageMetadata", error)); 
		});
	});
}

export async function getNuGetPackageUrl(vsoClient: vsom.VsoClient, feedId: string, packageId: string): Promise<string> {
	var PackagingAreaName = "Packaging";
	var PackageAreaId = "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197";
	
	return new Promise<string>((resolve, reject) => {
		var getVersioningDataPromise = vsoClient.getVersioningData(null, PackagingAreaName, PackageAreaId, { feedId: feedId, packageId: packageId });
		getVersioningDataPromise.then((result) => {
			return resolve(result.requestUrl); 
		});
		getVersioningDataPromise.catch((error) => {
			return reject(error)
		});
	});
}

export async function getDownloadUrl(vsoClient: vsom.VsoClient, feedId: string, packageName: string, version: string): Promise<string> {
	var NugetArea = "NuGet"
	var PackageVersionContentResourceId = "6EA81B8C-7386-490B-A71F-6CF23C80B388"
	return new Promise<string>((resolve, reject) => {
		var getVersioningDataPromise = vsoClient.getVersioningData(null, NugetArea, PackageVersionContentResourceId, { feedId: feedId, packageName: packageName, packageVersion: version });
		getVersioningDataPromise.then((result) => {
			return resolve(result.requestUrl); 
		});
		getVersioningDataPromise.catch((error) => {
			return reject(error)
		});
	});
}

export async function downloadNugetPackage(coreApi: corem.ICoreApi, downloadUrl: string, downloadPath: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		coreApi.http.get(downloadUrl).then(response => {
			tl.debug("Downloading package from url: " + downloadUrl);
			tl.debug("Download status: " + response.message.statusCode);

			if(response.message.statusCode != 200) {
				return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, response.message.statusMessage));
			}
			
			var responseStream = response.message as stream.Readable;
			var file = fs.createWriteStream(downloadPath);
			responseStream.pipe(file);
			responseStream.on("end", () => {
				console.log(tl.loc("PackageDownloadSuccessful"));
				file.on("close", () => {
					return resolve();
				});
			});
			responseStream.on("error", err => {
				file.close();
				return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, err));
			});

		}).catch(error => {
			return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, error));
		});
	});
}

function executeWithRetries(operationName: string, operation: () => Promise<any>, retryCount): Promise<any> {
    var executePromise = new Promise((resolve, reject) => {
        executeWithRetriesImplementation(operationName, operation, retryCount, resolve, reject);
    });

    return executePromise;
}

function executeWithRetriesImplementation(operationName: string, operation: () => Promise<any>, currentRetryCount, resolve, reject) {
    operation().then((result) => {
        resolve(result);
    }).catch((error) => {
        if (currentRetryCount <= 0) {
            tl.error(tl.loc("OperationFailed", operationName, error));
            reject(error);
        }
        else {
            console.log(tl.loc('RetryingOperation', operationName, currentRetryCount));
            currentRetryCount = currentRetryCount - 1;
            setTimeout(() => executeWithRetriesImplementation(operationName, operation, currentRetryCount, resolve, reject), 4 * 1000);
        }
    });
}

export async function unzip(zipLocation: string, unzipLocation: string): Promise<void> {

	await new Promise<void>(function (resolve, reject) {
		if (tl.exist(unzipLocation)) {
			tl.rmRF(unzipLocation);
		}

		tl.debug('Extracting ' + zipLocation + ' to ' + unzipLocation);
		tl.debug(`Using extract-zip package for extracting archive`);
		extract(zipLocation, { dir: unzipLocation }).then(() => {
			resolve();
		}).catch((error) => {
			reject(error);
		});
	});
}

main()
	.then(() => tl.setResult(tl.TaskResult.SucceededWithIssues, tl.loc("DeprecatedTask")))
	.catch((error) => tl.setResult(tl.TaskResult.Failed, error));
