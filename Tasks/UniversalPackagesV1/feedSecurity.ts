import * as tl from "azure-pipelines-task-lib";
import { getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";
import { UniversalPackageContext } from "./UniversalPackageContext";

// Feed security namespace ID
const FEED_SECURITY_NAMESPACE_ID = "9fed0191-dca2-4112-86b7-a6a48d1b204c";

// FeedRole enum values from server
enum FeedRole {
    Custom = 0, //Unsupported
    None = 1, //Unsupported
    Reader = 2,
    Contributor = 3,
    Administrator = 4,
    Collaborator = 5
}

function getFeedRoleName(role: FeedRole): string {
    switch (role) {
        case FeedRole.Reader:
            return "Feed Reader";
        case FeedRole.Collaborator:
            return "Feed and Upstream Reader (Collaborator)";
        case FeedRole.Contributor:
            return "Feed Publisher (Contributor)";
        case FeedRole.Administrator:
            return "Feed Owner";
        case FeedRole.None:
        default:
            return "None";
    }
}

// Batch permission evaluation structures
interface PermissionEvaluation {
    securityNamespaceId: string;
    token: string;
    permissions: number;
    value?: boolean;
}

interface PermissionEvaluationBatch {
    evaluations: PermissionEvaluation[];
    alwaysAllowAdministrators?: boolean;
}

// Feed API response structures
interface FeedDetails {
    id: string;
    name: string;
    project?: {
        id: string;
        name: string;
    };
}

// REST client error structure
interface RestError {
    statusCode?: number;
    message?: string;
}

const FeedPermissions = {
    None: 0,
    AdministerFeed: 1,
    ArchiveFeed: 2,
    DeleteFeed: 4,
    CreateFeed: 8,
    EditFeed: 16,
    ReadPackages: 32,
    AddPackage: 64,
    UpdatePackage: 128,
    DeletePackage: 256,
    DelistPackage: 1024,
    AddUpstreamPackage: 2048
} as const;

const FeedRoles = {
    /** None: No permissions */
    None: 0,
    
    /** Reader: Can read packages from the feed */
    Reader: FeedPermissions.ReadPackages, // 32
    
    /** Collaborator: Can read packages and add packages from upstream sources */
    Collaborator: FeedPermissions.ReadPackages | FeedPermissions.AddUpstreamPackage, // 2080
    
    /** Contributor: Can read, publish, update, and delist packages */
    Contributor: FeedPermissions.ReadPackages | FeedPermissions.AddPackage | FeedPermissions.UpdatePackage | FeedPermissions.DelistPackage | FeedPermissions.AddUpstreamPackage, // 3296
    
    /** Administrator: Total control over the feed */
    Administrator: FeedPermissions.AdministerFeed | FeedPermissions.ArchiveFeed | FeedPermissions.DeleteFeed | FeedPermissions.EditFeed | FeedPermissions.ReadPackages | FeedPermissions.AddPackage | FeedPermissions.UpdatePackage | FeedPermissions.DeletePackage | FeedPermissions.DelistPackage | FeedPermissions.AddUpstreamPackage // 4095
};

function constructFeedIdentityToken(projectId: string | null | undefined, feedId: string): string {
    if (projectId) {
        return `$/project:${projectId}/${feedId}/`;
    } else {
        return `$/${feedId}/`;
    }
}

export async function getFeedDiagnostics(context: UniversalPackageContext): Promise<string | null> {
    try {
        const webApi = getWebApiWithProxy(context.feedServiceUri, context.accessToken);
        const feedsServiceUri = context.feedServiceUri.replace(/\/+$/, ''); // Remove trailing slashes
        
        // Determine auth identity description for error messages
        let authIdentityDescription: string;
        if (context.adoServiceConnection) {
            authIdentityDescription = `Service connection '${context.adoServiceConnection}'`;
        } else {
            authIdentityDescription = `Build service`;
        }
        
        // Step 1: Call Feed API to check if feed exists and get GUIDs
        const feedApiUrl = context.projectName 
            ? `${feedsServiceUri}/${encodeURIComponent(context.projectName)}/_apis/Packaging/Feeds/${encodeURIComponent(context.feedName)}?api-version=7.1-preview.1`
            : `${feedsServiceUri}/_apis/Packaging/Feeds/${encodeURIComponent(context.feedName)}?api-version=7.1-preview.1`;
        
        tl.debug(tl.loc('Debug_CallingFeedApi', feedApiUrl));
        
        let feed: FeedDetails | undefined;
        try {
            feed = (await webApi.rest.get<FeedDetails>(feedApiUrl))?.result;
        } catch (feedError) {
            // Handle Feed API errors
            const error = feedError as RestError;
            const statusCode = error.statusCode;
            const errorMessage = error.message || String(feedError);
            
            if (statusCode === 404) {
                return tl.loc('Warning_FeedDoesNotExist', context.feedName);
            } else if (statusCode === 401 || statusCode === 403) {
                return tl.loc('Warning_NotAuthorizedToAccessFeed', authIdentityDescription, context.feedName);
            } else {
                return tl.loc('Warning_FeedInformationUnavailable', errorMessage);
            }
        }
        
        // Feed exists - extract GUIDs
        if (!feed) {
            return tl.loc('Warning_FeedInformationEmpty');
        }
        
        const feedId = feed.id;
        const projectId = feed.project?.id;
        
        tl.debug(tl.loc('Debug_FeedFound', feedId, projectId || 'N/A'));
        
        // Step 2: Check permissions using the feed and project GUIDs
        const feedIdentityToken = constructFeedIdentityToken(projectId, feedId);
        const batch: PermissionEvaluationBatch = {
            evaluations: [
                { securityNamespaceId: FEED_SECURITY_NAMESPACE_ID, token: feedIdentityToken, permissions: FeedRoles.Reader },
                { securityNamespaceId: FEED_SECURITY_NAMESPACE_ID, token: feedIdentityToken, permissions: FeedRoles.Collaborator },
                { securityNamespaceId: FEED_SECURITY_NAMESPACE_ID, token: feedIdentityToken, permissions: FeedRoles.Contributor },
                { securityNamespaceId: FEED_SECURITY_NAMESPACE_ID, token: feedIdentityToken, permissions: FeedRoles.Administrator }
            ]
        };
        
        const permissionsApiUrl = `${feedsServiceUri}/_apis/security/permissionevaluationbatch?api-version=7.1`;
        tl.debug(tl.loc('Debug_CallingPermissionsApi', permissionsApiUrl));
        tl.debug(tl.loc('Debug_FeedIdentityToken', feedIdentityToken));
        
        let permissionsResult: PermissionEvaluationBatch | undefined;
        try {
            permissionsResult = (await webApi.rest.create<PermissionEvaluationBatch>(permissionsApiUrl, batch))?.result;
        } catch (permError) {
            const error = permError as RestError;
            const errorMessage = error.message || String(permError);
            return tl.loc('Warning_UnableToDeterminePermissions', context.feedName, errorMessage);
        }
        
        if (!permissionsResult?.evaluations || permissionsResult.evaluations.length !== 4) {
            return tl.loc('Warning_UnableToDeterminePermissionsUnknown', context.feedName);
        }
        
        // Determine the actual role the user has (highest permission level)
        let actualRole = FeedRole.None;
        if (permissionsResult.evaluations[3].value) {
            actualRole = FeedRole.Administrator;
        } else if (permissionsResult.evaluations[2].value) {
            actualRole = FeedRole.Contributor;
        } else if (permissionsResult.evaluations[1].value) {
            actualRole = FeedRole.Collaborator;
        } else if (permissionsResult.evaluations[0].value) {
            actualRole = FeedRole.Reader;
        }
        
        // Build error message based on command
        let permissionMessage: string;
        if (actualRole === FeedRole.None) {
            permissionMessage = tl.loc('Warning_NoPermissionsOnFeed', authIdentityDescription, context.feedName);
            if (context.command === 'download') {
                permissionMessage += ' ' + tl.loc('Warning_DownloadRequiresReaderAccess', getFeedRoleName(FeedRole.Reader), getFeedRoleName(FeedRole.Collaborator));
            }
        } else {
            permissionMessage = tl.loc('Warning_HasAccessToFeed', authIdentityDescription, getFeedRoleName(actualRole), context.feedName);
            
            if (context.command === 'publish' && actualRole !== FeedRole.Contributor && actualRole !== FeedRole.Administrator) {
                permissionMessage += ' ' + tl.loc('Warning_PublishRequiresContributorAccess', getFeedRoleName(FeedRole.Contributor));
            }
        }
        
        return permissionMessage;
    } catch (err) {
        return null; // Don't fail the task if diagnostics themselves fail
    }
}

