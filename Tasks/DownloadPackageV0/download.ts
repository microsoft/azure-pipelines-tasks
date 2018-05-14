var fs = require('fs');
var http = require('http');
var DecompressZip = require('decompress-zip');
var path = require('path')

import * as corem from 'vso-node-api/CoreApi';
import * as restm from 'vso-node-api/RestClient';
import * as tl from 'vsts-task-lib/task';
import * as vsom from 'vso-node-api/VsoClient';
import * as vsts from "vso-node-api/WebApi"
import bearm = require('vso-node-api/handlers/bearertoken');

const ApiVersion = "3.0-preview.1";
tl.setResourcePath(path.join(__dirname, 'task.json'));

async function main(): Promise<void> {
	let feedId = tl.getInput("feed");
	let regexGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	let packageId = tl.getInput("definition");

	if(!regexGuid.test(packageId)){
		packageId = "Nuget_" + tl.getInput("definition");
	}

	let version = tl.getInput("version");
	let downloadPath = tl.getInput("downloadPath");
	let collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");

	var accessToken = getAuthToken();
	var credentialHandler = vsts.getBearerHandler(accessToken);
	var vssConnection = new vsts.WebApi(collectionUrl, credentialHandler);
	var coreApi = vssConnection.getCoreApi();

	await downloadPackage(collectionUrl, credentialHandler, feedId, packageId, version, downloadPath);
}

function getAuthToken() {
	var auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
	if (auth.scheme.toLowerCase() === 'oauth') {
		return auth.parameters['AccessToken'];
	}
	else {
		throw new Error(tl.loc("CredentialsNotFound"))
	}
}

export async function downloadPackage(collectionUrl: string, credentialHandler: bearm.BearerCredentialHandler, feedId: string, packageId: string, version: string, downloadPath: string) {
	
	var feedsUrl = collectionUrl.replace(".visualstudio.com",".feeds.visualstudio.com");
	var feedConnection = new vsts.WebApi(feedsUrl, credentialHandler);
	
	var packagesUrl = collectionUrl.replace(".visualstudio.com",".pkgs.visualstudio.com");
	var packageConnection = new vsts.WebApi(packagesUrl, credentialHandler);
	
	var packageUrl = await getNuGetPackageUrl(feedConnection.getCoreApi().vsoClient, feedId, packageId);
	
	await new Promise((resolve, reject) => {
		feedConnection.getCoreApi().restClient.get(packageUrl, ApiVersion, null, { responseIsCollection: false }, async function (error, status, result) {
			if (!!error || status != 200) {
				return reject(tl.loc("FailedToGetPackageMetadata", error));
			}

			var packageType = result.protocolType.toLowerCase();
			var packageName = result.name;

			if (packageType == "nuget") {
				
				var getDownloadUrlPromise = getDownloadUrl(packageConnection.getCoreApi().vsoClient, feedId, packageName, version)
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
				
				var downloadNugetPackagePromise = downloadNugetPackage(packageConnection.getCoreApi(), downloadUrl, zipLocation);
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
					tl.rmRF(zipLocation, false);
				}

				return resolve();
			}
			else {
				return reject(tl.loc("PackageTypeNotSupported"));
			}
		});
	});
}

export async function getNuGetPackageUrl(vsoClient: vsom.VsoClient, feedId: string, packageId: string): Promise<string> {
	var PackagingAreaName = "Packaging";
	var PackageAreaId = "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197";
	
	return new Promise<string>((resolve, reject) => {
		var getVersioningDataPromise = vsoClient.getVersioningData(ApiVersion, PackagingAreaName, PackageAreaId, { feedId: feedId, packageId: packageId });
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
		var getVersioningDataPromise = vsoClient.getVersioningData(ApiVersion, NugetArea, PackageVersionContentResourceId, { feedId: feedId, packageName: packageName, packageVersion: version });
		getVersioningDataPromise.then((result) => {
			return resolve(result.requestUrl); 
		});
		getVersioningDataPromise.catch((error) => {
			return reject(error)
		});
	});
}

export async function downloadNugetPackage(coreApi: corem.ICoreApi, downloadUrl: string, downloadPath: string): Promise<void> {
	var file = fs.createWriteStream(downloadPath);
	await new Promise<void>((resolve, reject) => {
		var accept = coreApi.restClient.createAcceptHeader("application/zip", ApiVersion);
		coreApi.restClient.httpClient.getStream(downloadUrl, accept, function (error, status, result) {
			tl.debug("Downloading package from url: " + downloadUrl);
			tl.debug("Download status: " + status);
			if (!!error || status != 200) {
				return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, error));
			}

			result.pipe(file);
			result.on("end", () => {
				console.log(tl.loc("PackageDownloadSuccessful"));
				return resolve();
			});
			result.on("error", err => {
				return reject(tl.loc("FailedToDownloadNugetPackage", downloadUrl, err));
			});
		});
	});

	file.end(null, null, file.close);
}

export async function unzip(zipLocation: string, unzipLocation: string): Promise<void> {

	await new Promise<void>(function (resolve, reject) {
		if (tl.exist(unzipLocation)) {
			tl.rmRF(unzipLocation, false);
		}

		tl.debug('Extracting ' + zipLocation + ' to ' + unzipLocation);

		var unzipper = new DecompressZip(zipLocation);
		unzipper.on('error', err => {
			return reject(tl.loc("ExtractionFailed", err))
		});
		unzipper.on('extract', log => {
			tl.debug('Extracted ' + zipLocation + ' to ' + unzipLocation + ' successfully');
			return resolve();
		});

		unzipper.extract({
			path: unzipLocation
		});
	});
}

main()
	.then((result) => tl.setResult(tl.TaskResult.Succeeded, ""))
	.catch((error) => tl.setResult(tl.TaskResult.Failed, error));
