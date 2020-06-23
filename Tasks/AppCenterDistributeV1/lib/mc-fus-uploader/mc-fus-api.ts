export function getFileUploadLink(baseUrl: string, ownerName: string, appName: string): string {
  return baseUrl + "/v0.1/apps/" + ownerName + "/" + appName + "/uploads/releases";
}

export function getPatchUploadLink(baseUrl: string, ownerName: string, appName: string, uploadId: string): string {
  return baseUrl + "/v0.1/apps/" + ownerName + "/" + appName + "/uploads/releases/" + uploadId;
}
