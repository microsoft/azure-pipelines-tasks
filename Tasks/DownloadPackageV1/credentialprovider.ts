import { BearerCredentialHandler } from "azure-devops-node-api/handlers/bearertoken";

export class BearerHandlerForPresignedUrls extends BearerCredentialHandler {
    prepareRequest(options) {
        // If we have a presigned blobstore url, don't add auth header
        if (this.isPreSignedUrl(options)) {
            console.log("not adding header");
            delete options.headers["Authorization"];
            delete options.headers["X-TFS-FedAuthRedirect"];
        } else {
            console.log("adding header");
            options.headers["Authorization"] = "Bearer " + this.token;
            options.headers["X-TFS-FedAuthRedirect"] = "Suppress";
        }
    }

    isPreSignedUrl(options: any): boolean {
        return (
            options.host &&
            options.host.endsWith("blob.core.windows.net") &&
            options.path &&
            options.path.includes("&sig=")
        );
    }
}