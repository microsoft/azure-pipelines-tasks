export interface INuGetXmlHelper {
    AddSourceToNuGetConfig(
        name: string,
        source: string,
        username?: string,
        password?: string): void;

    RemoveSourceFromNuGetConfig(name: string): void;

    SetApiKeyInNuGetConfig(source: string, apiKey: string): void;
}