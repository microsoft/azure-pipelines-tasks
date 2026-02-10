# UniversalPackagesV1 Task Code — Extractability Analysis

## 1. UPack Is Missing from the Common Protocol Infrastructure

`artifacts-common/protocols.ts` defines `ProtocolType` as `NuGet | Maven | Npm | PyPi`. Universal Packages (UPack) is absent. This one omission has a cascading effect — all common functions that route through `getAreaIdForProtocol()` are unusable for this task:

- `getConnectionDataForProtocol()` — used by other tasks to resolve packaging service URIs and get connection data
- `getPackagingRouteUrl()` — used to get versioned routing URLs for protocol endpoints
- `getServiceUriFromAreaId()` — on-prem/hosted URI resolution

The task works around this by hardcoding the UPack area ID and calling `locationApi.getResourceArea()` directly in `getUniversalPackagesUri()`:

```typescript
const upackAreaId = 'd397749b-f115-4027-b6dd-77a65dd10d21';
const resourceArea = await retryOnException(
    () => context.locationApi.getResourceArea(upackAreaId), 3, 1000);
```

Similarly, `setIdentityInformation()` builds its own WebApi → locations API → connection data chain instead of calling `getConnectionDataForProtocol()`, because there's no `ProtocolType.UPack` to pass in.

**Fix:** Add `UPack` to the `ProtocolType` enum and its area ID to `getAreaIdForProtocol()`. This would let the task use the common routing/connection-data functions directly.

---

## 2. Provenance Doesn't Work with WIF Tokens

The existing `ProvenanceHelper.GetSessionId()` in `packaging-common/provenance.ts` accepts raw HTTP `handlers` (from `azure-devops-node-api`) and constructs a `ProvenanceApi` internally using `ClientApiBases`. This auth pipeline works with PAT/system tokens that go through `getBasicHandler()`.

WIF tokens come from a completely different exchange flow (OIDC → Entra). The resulting bearer token lives inside a `WebApi` instance created via `getWebApiWithProxy()` — it doesn't fit through the `handlers` parameter.

So `tryGetProvenanceSessionId()` in `universalPublish.ts` had to **bypass `ProvenanceHelper.GetSessionId()` entirely** and replicate the REST call (~50 lines) using the `WebApi` instance that already holds the WIF token:

```typescript
const webApi = getWebApiWithProxy(packagingUrl, context.accessToken);
const verData = await webApi.vsoClient.getVersioningData(
    "7.1-preview.1", "Provenance", "503B4E54-...", routeValues);
const response = await webApi.rest.create<SessionResponse>(
    verData.requestUrl, sessionRequest, requestOptions);
```

This is functionally identical to what `ProvenanceApi.createSession()` does internally — the only difference is how auth is threaded through.

**Fix:** `ProvenanceHelper.GetSessionId()` should accept a `WebApi` instance or an access token instead of raw HTTP handlers. Every publish-capable packaging task (NuGet push, npm publish) will face this same problem when they adopt WIF.

---

## 3. Feed Tenant Discovery — `GET` vs `HEAD` Discrepancy

The task needs to discover the target feed's tenant ID for cross-tenant WIF auth. `artifacts-common/EntraWifUserServiceConnectionUtils.ts` already exports a `getFeedTenantId()` function, but it uses `GET`. The task wrote its own version using `HEAD`, with a comment:

```typescript
// X-VSS-ResourceTenant is only returned on HEAD requests, not GET.
async function getFeedTenantId(feedUrl: string): Promise<string | undefined> {
    const response = await fetch(feedUrl, { method: 'HEAD' });
    return response?.headers?.get('X-VSS-ResourceTenant') ?? undefined;
}
```

Either the comment is correct and the common library function is broken, or the header is returned on both methods and the comment is stale. Either way, this should be resolved in `artifacts-common` rather than worked around in the task.

Additionally, `getFederatedWorkloadIdentityCredentials()` doesn't orchestrate tenant discovery itself — callers have to discover the tenant, then pass it in. If the function accepted an optional feed URL and handled discovery internally, each consuming task wouldn't need to implement the tenant-discovery → token-exchange choreography.

---

## 4. The WIF Auth Flow Should Be a Shared Module

The auth setup in `universalPackageHelpers.ts` (`trySetAuth` → `setServiceUris` → `trySetAccessToken` → `setIdentityInformation`) represents a complete pattern that any packaging task will need when adopting WIF:

1. Resolve service URIs (base + feed)
2. If service connection specified → discover feed tenant → get WIF token
3. Else → get system access token
4. Resolve authenticated identity (for error messages)
5. Set up tool runner options with the token in an env var

No other packaging task does this yet. When NuGet, npm, and pip add WIF support, they'll each need to build the same sequence. This should be a composable auth setup module in `artifacts-common`.

As part of this, `getSystemAccessToken()` currently has **four copies** across the common packages (`artifacts-common/webapi.ts`, `packaging-common/locationUtilities.ts`, `packaging-common/universal/ClientToolUtilities.ts`, `packaging-common/universal/Authentication.ts`), and this task adds a fifth. They differ in whether they call `tl.setSecret()` and whether they return `undefined` on failure. This should be consolidated.

---

## 5. Identity-Aware Error Handling

`handleTaskError()` in `universalPackageHelpers.ts` surfaces which identity was used when a task fails:

```typescript
if (context?.adoServiceConnection) {
    tl.warning(tl.loc("Warning_ServiceConnectionIdentityHint",
        context.adoServiceConnection, context.authIdentityName, context.authIdentityId));
} else if (context) {
    tl.warning(tl.loc("Warning_BuildServiceIdentityHint",
        context.authIdentityName, context.authIdentityId));
}
```

This is enormously helpful for debugging permissions issues ("you authed as X but don't have access to Y"). No other packaging task does this. It's completely generic — any task using authenticated API calls could benefit from it. This pattern (or a utility function) belongs in common packages.

---

## 6. `validateServerType()` — On-Prem Rejection

The task explicitly rejects on-premises servers since ArtifactTool doesn't support them. The common packages handle on-prem by silently falling back to the collection URI. Multiple tasks independently check `System.ServerType`:

- `connectionDataUtils.ts` / `locationUtilities.ts` / `ClientToolUtilities.ts` all have their own `getServiceUriFromAreaId()` with the same hosted check
- This task adds another variant that rejects instead of falling back

A shared `requireHostedAgent()` or `isHostedAgent()` function is trivial but would eliminate this duplication.

---

## Summary

| # | Issue | Impact | Fix Location |
|---|-------|--------|-------------|
| 1 | UPack missing from `ProtocolType` | Task can't use common routing/connection-data functions | `artifacts-common/protocols.ts` |
| 2 | `ProvenanceHelper` doesn't accept WIF tokens | 50-line workaround to replicate provenance REST call | `packaging-common/provenance.ts` |
| 3 | `getFeedTenantId()` GET vs HEAD discrepancy | Task has its own copy with different HTTP method | `artifacts-common/EntraWifUserServiceConnectionUtils.ts` |
| 4 | No shared WIF auth setup flow | Every future WIF-enabled task will reimplement the same sequence | New module in `artifacts-common` |
| 5 | Identity-aware error handling only in this task | Other tasks give opaque permission errors | `artifacts-common` or `packaging-common` |
| 6 | On-prem check duplicated everywhere | 4+ copies of `System.ServerType` checks | `artifacts-common` utility function |
