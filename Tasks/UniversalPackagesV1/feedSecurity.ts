import * as tl from "azure-pipelines-task-lib";
import { getWebApiWithProxy } from "azure-pipelines-tasks-artifacts-common/webapi";

// Feed security constants
export const FEED_SECURITY_NAMESPACE_ID = "9fed0191-dca2-4112-86b7-a6a48d1b204c";

// Response type from Azure DevOps Permissions API
interface PermissionsResponse {
    count: number;
    value: boolean[];
}

export const FeedPermissions = {
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

export const FeedRoles = {
    /** Reader: Can read packages from the feed */
    Reader: FeedPermissions.ReadPackages, // 32
    
    /** Collaborator: Can read packages and add packages from upstream sources */
    Collaborator: FeedPermissions.ReadPackages | FeedPermissions.AddUpstreamPackage, // 2080
    
    /** Contributor: Can read, publish, update, and delist packages */
    Contributor: FeedPermissions.ReadPackages | FeedPermissions.AddPackage | FeedPermissions.UpdatePackage | FeedPermissions.DelistPackage | FeedPermissions.AddUpstreamPackage // 3296
} as const;

export async function validateFeedPermissions(context: any): Promise<void> {
    const webApi = getWebApiWithProxy(context.serviceUri, context.accessToken);
    
    const requiredPermissions = context.command === 'publish' ? FeedRoles.Contributor : FeedRoles.Reader;
    const requiredRole = context.command === 'publish' ? 'Contributor or Owner' : 'Reader or higher';
    
    // Feed resource format: feedName or projectName/feedName (same as projectAndFeed)
    const permissionsUrl = `${context.serviceUri}/_apis/permissions/${FEED_SECURITY_NAMESPACE_ID}/${requiredPermissions}?tokens=${encodeURIComponent(context.projectAndFeed)}&api-version=7.1`;
    
    tl.debug(tl.loc('Debug_ValidatingFeedPermissions', context.projectAndFeed));
    tl.debug(tl.loc('Debug_RequiredPermissions', requiredPermissions, requiredRole));
    
    const response = await webApi.rest.get<PermissionsResponse>(permissionsUrl);
    
    if (response?.result?.value && Array.isArray(response.result.value) && response.result.value.length > 0) {
        const hasPermission = response.result.value[0];
        
        if (!hasPermission) {
            const errorMessage = tl.loc(
                'Error_InsufficientFeedPermissions',
                context.projectAndFeed,
                requiredRole
            );
            throw new Error(errorMessage);
        }
        
        tl.debug(tl.loc('Debug_FeedPermissionSuccess', requiredRole));
    } else {
        tl.warning(tl.loc('Warning_FeedPermissionCheckFailed'));
    }
}
