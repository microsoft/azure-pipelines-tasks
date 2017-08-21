export const ContainerTypeSetting = "__container_type__";
export const IncludeSourceTagsSetting = "__include_source_tags__";
export const AdditionalTagsSetting = "__additional_tags__";
export const ExpectedTags = "__expected_tags__";
export const ContainerType_ContainerRegistry = "Container Registry";
export const ContainerType_AzureContainerRegistry = "Azure Container Registry";

export const BaseImageNames = ["image1", "image2"];

export function qualifyImageName(endpoint: string, image: string) {
    if (endpoint) {
        return `${endpoint}/${image}`;
    } else {
        return image;
    }
};

