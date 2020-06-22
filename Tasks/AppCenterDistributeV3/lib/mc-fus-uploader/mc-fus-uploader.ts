// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
  IUploadData,
  IUploadStatus,
  McFusUploadState,
  IProgress,
  IUploadStats,
  McFusMessageLevel,
  McFusUploader,
  IRequiredSettings,
  IEventSettings,
  IInitializeSettings,
  IOptionalSettings,
  IOnResumeStartParams,
  McFusFile,
  LogProperties,
} from "./mc-fus-uploader-types";
import * as fs from "fs";
import fetch from "node-fetch";
import { MimeTypes } from "./mc-fus-mime-types";
import * as Path from "path";
import { AbortController } from "abort-controller";

export class McFile implements McFusFile {
  private path: string;

  public constructor(path: string) {
    this.path = path;
  }

  get size(): number {
    const stats = fs.statSync(this.path);
    return stats["size"];
  }

  get name(): string {
    return Path.basename(this.path);
  }

  slice(start: number, end: number): Buffer {
    const data = Buffer.alloc(end - start);
    const fd = fs.openSync(this.path, "r");
    fs.readSync(fd, data, 0, data.length, start);
    return data;
  }
}

class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(statusText);
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = status;
    this.statusText = statusText;
  }
}

export class McFusNodeUploader implements McFusUploader {
  private ambiguousProgress: number = 0;
  private progressUpdateRate: number = 0;
  private maxNumberOfConcurrentUploads: number = 10;

  private readonly uploadBaseUrls: any = {
    CancelUpload: "upload/cancel/",
    SetMetadata: "upload/set_metadata/",
    UploadChunk: "upload/upload_chunk/",
    UploadFinished: "upload/finished/",
    UploadStatus: "upload/status/",
  };

  // Should be visible for testing
  readonly uploadData: IUploadData = {
    assetId: "00000000-0000-0000-0000-000000000000",
    blobPartitions: 0,
    callbackUrl: "",
    correlationId: "00000000-0000-0000-0000-000000000000",
    correlationVector: "",
    chunkSize: 0,
    logToConsole: false,
    tenant: "",
    urlEncodedToken: "",
    totalBlocks: 0,
    uploadDomain: "",
  };

  // Should be visible for testing
  readonly uploadStatus: IUploadStatus = {
    autoRetryCount: 0,
    averageSpeed: 0,
    blocksCompleted: 0,
    chunksFailedCount: 0,
    chunkQueue: [],
    connected: true,
    endTime: new Date(),
    inflightSet: new Set(),
    abortController: new AbortController(),
    maxErrorCount: 20,
    serviceCallback: {
      autoRetryCount: 5,
      autoRetryDelay: 1,
      failureCount: 0,
    },
    startTime: new Date(),
    state: McFusUploadState.New,
    transferQueueRate: [],
  };

  private readonly eventHandlers: IEventSettings = {
    onProgressChanged: (progress: IProgress) => {},
    onCompleted: (uploadStats: IUploadStats) => {},
    onResumeRestart: (onResumeStartParams: IOnResumeStartParams) => {},
    onMessage: (message: string, properties: LogProperties, messageLevel: McFusMessageLevel) => {},
    onStateChanged: (state: McFusUploadState) => {},
  };

  constructor(args: IInitializeSettings) {
    this.initializeUpload(args);
  }

  private calculateAverageSpeed(): number {
    if (this.uploadStatus.transferQueueRate.length === 0) {
      return 0;
    }

    let rateSum = 0;

    for (const transferQueueRate of this.uploadStatus.transferQueueRate) {
      rateSum += transferQueueRate;
    }

    return rateSum / this.uploadStatus.transferQueueRate.length;
  }

  private calculateRate(): number {
    // Get the elapsed time in seconds
    const diff = new Date().getTime() - this.uploadStatus.startTime.getTime();
    const seconds = diff / 1000;
    if (seconds === 0) {
      return 0;
    }

    // Megabytes per second
    const speed = (this.uploadStatus.blocksCompleted * this.uploadData.chunkSize) / 1024 / 1024 / seconds;

    // Times 8 to convert bytes to bits
    const rate = speed * 8;
    return rate;
  }

  private calculateTimeRemaining(): number {
    const dataRemaining = this.uploadData.fileSize - this.uploadStatus.blocksCompleted * this.uploadData.chunkSize;
    if (this.uploadStatus.averageSpeed > 0 && dataRemaining > 0) {
      const timeSec = Math.floor((dataRemaining * 8) / (1024 * 1024 * this.uploadStatus.averageSpeed));
      return timeSec;
    }
    return 0;
  }

  private completeUpload() {
    // Only raise the completed event if we've not done it before, this can happen
    // due to a race condition on status checks calling finishUpload simultaneously
    if (this.uploadStatus.state === McFusUploadState.Completed) {
      return;
    }

    const rate = this.calculateRate();
    const diff = this.uploadStatus.endTime.getTime() - this.uploadStatus.startTime.getTime();
    const seconds = diff / 1000;

    const uploadStats: IUploadStats = {
      assetId: this.uploadData.assetId,
      totalTimeInSeconds: seconds.toFixed(1),
      averageSpeedInMbps: rate,
    };

    this.setState(McFusUploadState.Completed);
    const completeMessage =
      "UploadCompleted: " +
      " total time: " +
      uploadStats.totalTimeInSeconds +
      " seconds. Average speed: " +
      uploadStats.averageSpeedInMbps +
      " Mbps.";
    this.log(completeMessage, {
      UploadFileSize: this.uploadData.fileSize,
      UploadSpeed: uploadStats.averageSpeedInMbps,
      ElapsedSeconds: uploadStats.totalTimeInSeconds,
    });

    this.eventHandlers.onCompleted(uploadStats);
  }

  private enqueueChunks(chunks: number[]) {
    // if the queue is empty then just add all the chunks
    if (this.uploadStatus.chunkQueue.length === 0) {
      this.uploadStatus.chunkQueue = chunks;
      return;
    }

    // if there something in the queue, don't re-add a chunk. This
    // can result in more than one thread uploading the same chunk
    this.uploadStatus.chunkQueue = this.uploadStatus.chunkQueue.concat(
      chunks.filter(function (chunk) {
        return this.uploadStatus.chunkQueue.indexOf(chunk) < 0;
      })
    );
  }

  private error(errorMessage: string, properties: LogProperties = {}, errorCode?: McFusUploadState) {
    errorCode = errorCode || McFusUploadState.FatalError;
    this.setState(errorCode);
    properties.VerboseMessage = "Error Code: " + errorCode + " - " + errorMessage;
    this.log(errorMessage, properties, McFusMessageLevel.Error);
  }

  private finishUpload() {
    // Only verify the upload once at a time.
    if (this.uploadStatus.state === McFusUploadState.Verifying || this.uploadStatus.state === McFusUploadState.Completed) {
      return;
    }

    this.setState(McFusUploadState.Verifying);
    this.log("Verifying upload on server.");
    const self = this;
    this.sendRequest({
      type: "POST",
      useAuthentication: true,
      url:
        self.uploadBaseUrls.UploadFinished +
        encodeURIComponent(self.uploadData.assetId) +
        "?callback=" +
        encodeURIComponent(self.uploadData.callbackUrl),
      error: function (err: Error) {
        self.log("Finalize upload failed. Trying to autorecover... " + err.message);
        self.setState(McFusUploadState.Uploading);
        self.startUpload();
      },
      success: function (response: any) {
        // it's possible that the health check called complete before this method did.
        // Log the current status and proceed with response verification.
        if (self.uploadStatus.state !== McFusUploadState.Verifying) {
          self.log("Verifying: Upload status has changed, current status: " + self.uploadStatus.state);
        }

        //if no error then execute callback
        if (response.error === false && response.state === "Done") {
          self.log("UploadFinalized. McFus reported the upload as completed. Status message: " + response.message, {
            location: response.location,
          });

          // Finally report upload completion.
          self.completeUpload();

          // Attempt to perform a callback
          self.invokeCallback(response.raw_location);
        } else {
          // if chunks are missing enqueue missing chunks
          if (response.missing_chunks && response.missing_chunks.length > 0) {
            // If there are missing chunks lets adjust the completed count.
            self.uploadStatus.blocksCompleted = self.uploadData.totalBlocks - response.missing_chunks.length;

            self.enqueueChunks(response.missing_chunks);
            self.setState(McFusUploadState.Uploading);

            self.log("Finalizing found missing " + response.missing_chunks.length + " chunks. Requeuing chunks.", {
              ChunksMissing: response.missing_chunks,
            });

            const concurrentUploads = Math.min(self.maxNumberOfConcurrentUploads, self.uploadStatus.chunkQueue.length);
            for (let i = 0; i < concurrentUploads; i++) {
              self.singleThreadedUpload();
            }
            return;
          }

          // if no chunks are missing this must be an unhandled error
          // display the details to the user and stop the upload.
          self.error(response.message);
        }
      },
    });
  }

  private hasRequiredSettings(settings: IRequiredSettings): boolean {
    let hasSettings = true;

    if (!settings.assetId) {
      hasSettings = false;
      this.error("An AssetId must be specified.");
    }

    if (!settings.urlEncodedToken) {
      hasSettings = false;
      this.error("The upload UrlEncodedToken must be specified.");
    }

    if (!settings.uploadDomain) {
      hasSettings = false;
      this.error("The UploadDomain must be specified.");
    }

    if (!settings.tenant) {
      hasSettings = false;
      this.error("The Tenant name must be specified.");
    }

    return hasSettings;
  }

  private startUpload() {
    this.setState(McFusUploadState.Uploading);

    // Failing shows progress
    this.eventHandlers.onProgressChanged({
      percentCompleted: ++this.ambiguousProgress,
      rate: "",
      averageSpeed: "",
      timeRemaining: "",
    });
    this.log("Starting singleThreadedUpload with chunks: " + this.uploadStatus.chunkQueue);
    const concurrentUploads = Math.min(this.maxNumberOfConcurrentUploads, this.uploadStatus.chunkQueue.length);
    for (let i = 0; i < concurrentUploads; i++) {
      this.singleThreadedUpload();
    }
  }

  private hookupEventListeners(settings: IEventSettings) {
    this.eventHandlers.onProgressChanged = settings.onProgressChanged;
    this.eventHandlers.onCompleted = settings.onCompleted;
    this.eventHandlers.onResumeRestart = settings.onResumeRestart;
    this.eventHandlers.onMessage = settings.onMessage;
    this.eventHandlers.onStateChanged = settings.onStateChanged;
  }

  private initializeUpload(settings: IInitializeSettings) {
    // Validate required arguments if any
    // is missing the upload will fail.
    if (!this.hasRequiredSettings(settings)) {
      return;
    }

    // Validate optional arguments if not
    // provided we fallback to defaults.
    this.processOptionalSettings(settings);

    // Hookup all the event user defined event handlers.
    this.hookupEventListeners(settings);

    // After all checks have completed finally proceed
    // to initialize all the upload required fields.
    this.setState(McFusUploadState.New);

    // Initialize all retry flags for the new upload.
    this.uploadStatus.autoRetryCount = 3;
    this.uploadStatus.blocksCompleted = 0;
    this.uploadStatus.serviceCallback.autoRetryCount = 5;
    this.uploadStatus.serviceCallback.autoRetryDelay = 1;
    this.uploadStatus.serviceCallback.failureCount = 0;

    // Copy all the required settings on to the upload data.
    this.uploadData.assetId = settings.assetId;
    this.uploadData.uploadDomain = settings.uploadDomain;
    this.uploadData.urlEncodedToken = settings.urlEncodedToken;
    this.uploadData.tenant = settings.tenant;

    this.log("Upload created");
  }

  private invokeCallback(location: string) {
    if (this.uploadData.callbackUrl && this.uploadData.callbackUrl !== "") {
      const callbackUrl =
        this.uploadData.callbackUrl +
        "/" +
        encodeURIComponent(this.uploadData.assetId) +
        "?file_name=" +
        encodeURIComponent(this.uploadData.file!.name) +
        "&file_size=" +
        encodeURIComponent(this.uploadData.fileSize) +
        "&location=" +
        location;
      this.log("Callback was supplied. Invoking callback on: " + callbackUrl);
      const self = this;
      this.sendRequest({
        type: "POST",
        url: callbackUrl,
        useBaseDomain: false,
        useAuthentication: false,
        error: function (err: Error) {
          const errorMessage = "Callback failed. Status: " + err.message;

          // Non-fatal error, just log info
          self.log(errorMessage, { FailedCallback: self.uploadData.callbackUrl });

          // If we still have retries available go ahead with the success callback.
          if (self.uploadStatus.serviceCallback.autoRetryCount > 0) {
            setTimeout(function () {
              self.invokeCallback(location);
            }, self.uploadStatus.serviceCallback.autoRetryDelay * 10);

            self.uploadStatus.serviceCallback.autoRetryCount--;
            self.uploadStatus.serviceCallback.failureCount++;

            // Increment the backoff in multiples of 5 for
            // subsequent attempts. (5, 25, 125 and so on)
            self.uploadStatus.serviceCallback.autoRetryDelay *= 5;
          } else {
            self.log(
              "Callback retries depleted. The upload completed but the uploader was unable to perform a successful callback notifying completion."
            );
          }
        },
        success: function () {
          self.log("Callback succeeded.");
        },
      });
    }
  }

  private isUploadInProgress(): boolean {
    return (
      this.uploadStatus.state === McFusUploadState.Initialized ||
      this.uploadStatus.state === McFusUploadState.Uploading ||
      this.uploadStatus.state === McFusUploadState.Verifying
    );
  }

  private isValidChunk(chunk: Buffer): boolean {
    return chunk && chunk.length > 0;
  }

  private log(message: string, properties: LogProperties = {}, level: McFusMessageLevel = McFusMessageLevel.Information) {
    properties.VerboseMessage = "mc-fus-uploader - " + (properties.VerboseMessage ? properties.VerboseMessage : message);
    properties = this.getLoggingProperties(properties);
    this.eventHandlers.onMessage(message, properties, level);
  }

  private processOptionalSettings(settings: IOptionalSettings) {
    this.uploadData.callbackUrl = settings.callbackUrl ? decodeURI(settings.callbackUrl) : "";
    this.uploadData.correlationId = settings.correlationId || settings.assetId;
    this.uploadData.correlationVector = settings.correlationVector || "";
    this.uploadData.logToConsole = settings.logToConsole || false;
  }

  private reportProgress() {
    let percentCompleted = (this.uploadStatus.blocksCompleted * 100) / this.uploadData.totalBlocks;

    // Since workers that are on async processes can't be aborted there is a chance
    // that a chunk will be inflight and account as missing so when it gets resent
    // it will get accounted twice, since accounting for inflight chunks on the percentage
    // calculation is not reliable if we go over 100 we'll just mark it as 99.99.
    if (percentCompleted > 100) {
      percentCompleted = 99;
    }
    this.ambiguousProgress = Math.max(this.ambiguousProgress, percentCompleted);

    const rate = this.calculateRate();
    this.uploadStatus.transferQueueRate.push(rate);

    if (this.uploadStatus.transferQueueRate.length > 100) {
      this.uploadStatus.transferQueueRate.shift();
    }

    this.uploadStatus.averageSpeed = this.calculateAverageSpeed();

    const progress: IProgress = {
      percentCompleted: percentCompleted,
      rate: rate.toFixed(2),
      averageSpeed: this.uploadStatus.averageSpeed.toFixed(0),
      timeRemaining: this.calculateTimeRemaining().toFixed(0),
    };

    this.eventHandlers.onProgressChanged(progress);
  }

  private sendRequest(requestOptions: any) {
    // Check if the caller specifies a fully qualified url
    // or if it needs the McFus base domain to be appended.
    let requestUrl;
    if (requestOptions.useBaseDomain === false) {
      requestUrl = requestOptions.url;
    } else {
      requestUrl = this.uploadData.uploadDomain + "/" + requestOptions.url;
    }

    // All the call requires auth then we add the McFus token
    if (requestOptions.useAuthentication && requestOptions.useAuthentication === true) {
      if (requestUrl.indexOf("?") > 0) {
        requestUrl += "&";
      } else {
        requestUrl += "?";
      }
      requestUrl += `token=${this.uploadData.urlEncodedToken}`;
    }

    // If cache is disabled we add a timestamp to the url.
    if (requestOptions.cache !== undefined && requestOptions.cache === false) {
      requestUrl += "&_=" + new Date().getTime();
    }
    let body;
    if (requestOptions.chunk) {
      // @ts-ignore
      // this check addresses a trailing zeros bug, where part of the chunk will be empty. Simply touching the size is enough to "fix" the problem
      const size = requestOptions.chunk.size;
      body = requestOptions.chunk;
    }
    const self = this;
    fetch(requestUrl, {
      method: requestOptions.type,
      headers: {
        "X-Correlation-ID": self.uploadData.correlationId,
      },
      body: body,
      signal: self.uploadStatus.abortController.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new HttpError(response.status, response.statusText);
        }
        return response.json().catch((error) => {
          throw new HttpError(response.status, error);
        });
      })
      .then((json) => {
        if (requestOptions.success) {
          requestOptions.success(json);
        }
      })
      .catch((error) => {
        // Any other status code or if the page has markup it is
        // considered as failed and invokes to the error callback.
        if (requestOptions.error) {
          requestOptions.error(error);
        }
      });
  }

  private setMetadata() {
    this.eventHandlers.onProgressChanged({
      percentCompleted: ++this.ambiguousProgress,
      rate: "",
      averageSpeed: "",
      timeRemaining: "",
    });
    const logProperties = {
      fileName: this.uploadData.file!.name,
      fileSize: this.uploadData.fileSize,
    };
    this.log("Setting Metadata.", logProperties);
    const fileExt = this.uploadData.file!.name.split(".").pop() as string;
    const mimeTypeParam = MimeTypes[fileExt] ? `&content_type=${encodeURIComponent(MimeTypes[fileExt])}` : ``;
    const self = this;
    this.sendRequest({
      type: "POST",
      useAuthentication: true,
      url:
        self.uploadBaseUrls.SetMetadata +
        encodeURIComponent(self.uploadData.assetId) +
        "?file_name=" +
        encodeURIComponent(self.uploadData.file!.name) +
        "&file_size=" +
        encodeURIComponent(self.uploadData.fileSize) +
        mimeTypeParam,
      error: function (err: Error) {
        if (err instanceof HttpError) {
          Object.assign(logProperties, {
            StatusCode: err.status,
            StatusText: err.statusText,
          });
          self.error("The asset cannot be uploaded. Failed to set metadata.", logProperties);
        } else {
          self.error("Upload Failed. No network detected. Please try again." + err, {}, McFusUploadState.Error);
        }
      },
      success: function (response: any) {
        self.eventHandlers.onProgressChanged({
          percentCompleted: ++self.ambiguousProgress,
          rate: "",
          averageSpeed: "",
          timeRemaining: "",
        });
        // if we get an html document back we likely have a server error so report it and stop
        if (response.error === undefined && response.toString().indexOf("<!DOCTYPE html>") === 0) {
          //strip off everything outside the body tags
          const body = response.replace(/^[\S\s]*<body[^>]*?>/i, "").replace(/<\/body[\S\s]*$/i, "");
          self.error(body);
          return;
        }

        // Probably dead code - unable to return error body for 200 status code
        if (response.error) {
          Object.assign(logProperties, {
            StatusCode: response.currentTarget.status,
            StatusText: response.currentTarget.statusText,
          });
          self.error(response.message, logProperties);
          return;
        }

        Object.assign(logProperties, { serverLocation: response.server_location, chunkSize: response.chunk_size });
        self.log("Set metadata completed.", logProperties);
        self.uploadData.chunkSize = response.chunk_size;
        self.uploadData.blobPartitions = response.blob_partitions;

        // Calculate the number of chunks to send
        self.uploadData.totalBlocks = Math.ceil(self.uploadData.fileSize / self.uploadData.chunkSize);
        self.progressUpdateRate = Math.ceil(self.uploadData.totalBlocks / 100);
        self.log("Chunks to upload: " + self.uploadData.totalBlocks);

        self.enqueueChunks(response.chunk_list);

        // Handle the restart/resume/recovery scenario
        if (response.resume_restart) {
          self.setState(McFusUploadState.ResumeOrRestart);
          const remainingChunksToUpload = response.chunk_list.length;
          self.log("Chunks remaining to upload: " + remainingChunksToUpload);

          self.uploadStatus.blocksCompleted = self.uploadData.totalBlocks - remainingChunksToUpload;
          self.eventHandlers.onResumeRestart({ numberOfChunksRemaining: remainingChunksToUpload });
        } else {
          self.uploadStatus.blocksCompleted = 0;
          self.uploadStatus.startTime = new Date();
          self.startUpload();
        }
      },
    });
  }

  private setState(state: McFusUploadState) {
    this.uploadStatus.state = state;
    this.log("Setting state: " + state);
    this.eventHandlers.onStateChanged(state);
  }

  private singleThreadedUpload() {
    if (this.uploadStatus.chunkQueue.length === 0 && this.uploadStatus.inflightSet.size === 0) {
      this.uploadStatus.endTime = new Date();
      this.finishUpload();
      return;
    }

    if (this.uploadStatus.chunksFailedCount > this.uploadStatus.maxErrorCount) {
      if (this.uploadStatus.state === McFusUploadState.Uploading) {
        // Treat client disconnect errors as non-fatal errors as a service health indicator.
        if (this.uploadStatus.connected) {
          this.error("Upload Failed. Encountered too many errors while uploading. Please try again.");
        } else {
          this.error("Upload Failed. No network detected. Please try again.", {}, McFusUploadState.Error);
        }
      }
      // Cancel any single threaded operations.
      this.abortSingleThreadedUploads();
      return;
    }

    const chunkNumber = this.uploadStatus.chunkQueue.pop();

    // Safety check in case the queue got emptied before or is still in flight.
    if (chunkNumber === undefined || this.uploadStatus.inflightSet.has(chunkNumber)) {
      return;
    }

    // Otherwise just start processing and uploading the chunk
    const start = (chunkNumber - 1) * this.uploadData.chunkSize;
    const end = Math.min(chunkNumber * this.uploadData.chunkSize, this.uploadData.fileSize);
    const chunk = this.uploadData.file!.slice(start, end);

    // Don't request if chunk is empty or in the wrong state
    if (!this.isValidChunk(chunk) || this.uploadStatus.state !== McFusUploadState.Uploading) {
      return;
    }

    this.uploadChunk(chunk, chunkNumber);
  }

  private abortSingleThreadedUploads() {
    this.uploadStatus.abortController.abort();
  }

  private getLoggingProperties(data: LogProperties): LogProperties {
    const properties = {
      assetId: this.uploadData.assetId,
      correlationId: this.uploadData.correlationId,
      tenant: this.uploadData.tenant,
    };
    Object.assign(properties, data);
    return properties;
  }

  private uploadChunk(chunk: Buffer, chunkNumber: number) {
    this.uploadStatus.inflightSet.add(chunkNumber);
    this.log("Starting upload for chunk: " + chunkNumber);
    const self = this;
    this.sendRequest({
      type: "POST",
      useAuthentication: true,
      chunk: chunk,
      url: self.uploadBaseUrls.UploadChunk + encodeURIComponent(self.uploadData.assetId) + "?block_number=" + chunkNumber,
      error: function (err: Error) {
        self.uploadStatus.inflightSet.delete(chunkNumber);
        self.uploadChunkErrorHandler(err, chunkNumber);
      },
      success: function (response: any) {
        self.uploadStatus.inflightSet.delete(chunkNumber);
        if (response.error) {
          self.uploadChunkErrorHandler(response.error, chunkNumber);
          return;
        } else {
          // If a user is struggling to upload, we can increase the MaxErrorCount on each success in order to keep trying while they are making some progress.
          ++self.uploadStatus.maxErrorCount;
          self.uploadStatus.connected = true;
          self.log("ChunkSucceeded: " + chunkNumber + ".");
          if (++self.uploadStatus.blocksCompleted % self.progressUpdateRate === 0) {
            self.reportProgress();
          }
        }

        self.singleThreadedUpload();
      },
    });
  }

  private uploadChunkErrorHandler(error: Error, chunkNumber: number) {
    ++this.uploadStatus.chunksFailedCount;
    this.uploadStatus.chunkQueue.push(chunkNumber);
    if (error instanceof HttpError) {
      this.log("ChunkFailed: " + chunkNumber + ".", {
        StatusCode: error.status,
        StatusText: error.statusText,
      });
      this.uploadStatus.connected = true;
      this.singleThreadedUpload();
    } else {
      // If the user has gone offline, use a timeout for retrying instead
      this.log("ChunkFailed: " + chunkNumber + ": " + error.message);
      this.uploadStatus.connected = false;
      this.log("No network detected. Attempting chunk upload again in 10s.");
      const self = this;
      setTimeout(() => {
        self.singleThreadedUpload();
      }, 1000 * 10 /* 10 seconds */);
    }
  }

  public start(file: McFusFile) {
    if (!file || file.size <= 0) {
      this.error("A file must be specified and must not be empty.", {}, McFusUploadState.Error);
      return;
    }

    if (this.isUploadInProgress()) {
      // Non fatal error. Introducing a warning level is an API breaking change in portal. error() changes state.
      this.log("Cannot start an upload that is already in progress.", undefined, McFusMessageLevel.Error);
      return;
    }

    this.uploadData.file = file;
    this.uploadData.fileSize = file.size;
    this.setState(McFusUploadState.Initialized);
    this.setMetadata();
  }

  public cancel() {
    this.log("UploadCancelled");

    const self = this;
    this.sendRequest({
      type: "POST",
      useAuthentication: true,
      url: self.uploadBaseUrls.CancelUpload + encodeURIComponent(self.uploadData.assetId),
      success: function (response: any) {
        self.log(response.message);
        self.setState(McFusUploadState.Cancelled);

        self.abortSingleThreadedUploads();
      },
    });
  }
}
