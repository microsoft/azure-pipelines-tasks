import * as models from 'artifact-engine/Models';
import * as providers from 'artifact-engine/Providers';

// 100 is the maximum supported per_page value for GitHub's List release assets REST endpoint:
// https://docs.github.com/en/rest/releases/assets#list-release-assets
const githubPageSize: number = 100;

export async function getPaginatedArtifactItems(
    artifactItem: models.ArtifactItem,
    getPageItems: (pageArtifactItem: models.ArtifactItem) => Promise<models.ArtifactItem[]>
): Promise<models.ArtifactItem[]> {
    const items: models.ArtifactItem[] = [];
    let pageNumber: number = 1;

    while (true) {
        const pageArtifactItem = new models.ArtifactItem();
        Object.assign(pageArtifactItem, artifactItem);
        pageArtifactItem.metadata = Object.assign({}, artifactItem.metadata, {
            downloadUrl: getPageUrl(artifactItem.metadata["downloadUrl"], pageNumber)
        });

        const pageItems = await getPageItems(pageArtifactItem);
        items.push(...pageItems);

        if (pageItems.length < githubPageSize) {
            return items;
        }

        pageNumber++;
    }
}

export class GitHubReleaseProvider extends providers.WebProvider {
    public getArtifactItems(artifactItem: models.ArtifactItem): Promise<models.ArtifactItem[]> {
        if (artifactItem.path) {
            return super.getArtifactItems(artifactItem);
        }

        return getPaginatedArtifactItems(
            artifactItem,
            pageArtifactItem => super.getArtifactItems(pageArtifactItem)
        );
    }
}

function getPageUrl(itemsUrl: string, pageNumber: number): string {
    const separator = itemsUrl.indexOf('?') === -1 ? '?' : '&';
    return `${itemsUrl}${separator}per_page=${githubPageSize}&page=${pageNumber}`;
}
