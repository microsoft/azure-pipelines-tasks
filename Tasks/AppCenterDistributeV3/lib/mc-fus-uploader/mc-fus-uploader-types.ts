export interface McFusUploader {
  start(file: McFusFile): void;
  cancel(): void;
}

export enum McFusMessageLevel {
  Information = 0,
  Verbose = 1,
  Error = 2,
}

export enum McFusUploadState {
  New = 0,
  Initialized = 10,
  Uploading = 20,
  ResumeOrRestart = 40,
  Paused = 50,
  Error = 60,
  Cancelled = 80,
  Verifying = 90,
  Completed = 100,
  FatalError = 500,
}

export interface IRequiredSettings {
  assetId: string;
  uploadDomain: string;
  tenant: string;
  urlEncodedToken: string;
}

export interface IEventSettings {
  onProgressChanged(progress: IProgress): void;
  onCompleted(uploadStats: IUploadStats): void;
  onResumeRestart?(OnResumeStartParams: IOnResumeStartParams): void;
  onMessage(message: string, properties: LogProperties, messageLevel: McFusMessageLevel): void;
  onStateChanged(state: McFusUploadState): void;
}

export interface IOptionalSettings {
  assetId: string;
  callbackUrl?: string;
  correlationId?: string;
  correlationVector?: string;
  logToConsole?: boolean;
}

export interface IInitializeSettings extends IRequiredSettings, IEventSettings, IOptionalSettings {}

export interface IOnResumeStartParams {
  numberOfChunksRemaining: number;
}

export interface IUploadStatus {
  autoRetryCount: number;
  averageSpeed: number;
  blocksCompleted: number;
  chunksFailedCount: number;
  chunkQueue: Array<number>;
  connected: boolean;
  endTime: Date;
  inflightSet: Set<number>;
  abortController: AbortController;
  maxErrorCount: number;
  serviceCallback: IServiceCallback;
  startTime: Date;
  state: McFusUploadState;
  transferQueueRate: number[];
}

export interface IServiceCallback {
  autoRetryCount: number;
  autoRetryDelay: number;
  failureCount: number;
}

export interface IProgress {
  percentCompleted: number;
  rate: string;
  averageSpeed: string;
  timeRemaining: string;
}

export interface IUploadData {
  assetId: string;
  blobPartitions: number;
  callbackUrl: string;
  correlationId: string;
  correlationVector: string;
  chunkSize: number;
  file?: McFusFile;
  fileSize?: number;
  logToConsole: boolean;
  tenant: string;
  urlEncodedToken: string;
  totalBlocks: number;
  uploadDomain: string;
}

export interface IUploadStats {
  assetId: string;
  totalTimeInSeconds: string;
  averageSpeedInMbps: number;
}

export type LogProperties = { [key: string]: string | string[] | number | boolean | undefined };

export interface McFusFile {
  readonly name: string;
  readonly size: number;
  slice(start: number, end: number): Buffer;
}
