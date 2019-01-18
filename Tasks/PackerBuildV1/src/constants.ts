export var BuiltInTemplateOSTypeWindows = "windows";
export var BuiltInWindowsDefaultImageTemplateName = "default.windows.template.json";
export var BuiltInWindowsCustomImageTemplateName = "custom.windows.template.json";
export var BuiltInTemplateOSTypeLinux = "linux";
export var BuiltInLinuxDefaultImageTemplateName = "default.linux.template.json";
export var BuiltInLinuxCustomImageTemplateName = "custom.linux.template.json";

export var BuiltInManagedWindowsDefaultImageTemplateName = "default.managed.windows.template.json";
export var BuiltInManagedWindowsCustomImageTemplateName = "custom.managed.windows.template.json";
export var BuiltInManagedLinuxDefaultImageTemplateName = "default.managed.linux.template.json";
export var BuiltInManagedLinuxCustomImageTemplateName = "custom.managed.linux.template.json";

export var ResourceGroupInputName = "azureResourceGroup";
export var StorageAccountInputName = "storageAccountName";
export var BaseImageSourceInputName = "baseImageSource";
export var BuiltinBaseImageInputName = "baseImage";
export var CustomImageUrlInputName = "customImageUrl";
export var CustomImageOsTypeInputName = "customImageOSType";
export var ManagedImageInputName = "isManagedImage";
export var ManagedImageNameInputName = "managedImageName";
export var ImagePublisherInputName = "imagePublisher";
export var ImageOfferInputName = "imageOffer";
export var ImageSkuInputName = "imageSku";
export var LocationInputName = "location";
export var DeployScriptPathInputName = "deployScriptPath";
export var DeployPackageInputName = "packagePath";
export var DeployScriptArgumentsInputName = "deployScriptArguments";
export var ConnectedServiceInputName = "ConnectedServiceName";
export var TemplateTypeInputName = "templateType";
export var CustomTemplateLocationInputType = "customTemplateLocation";

export var TemplateVariableResourceGroupName = "resource_group";
export var TemplateVariableStorageAccountName = "storage_account";
export var TemplateVariableImagePublisherName = "image_publisher";
export var TemplateVariableImageOfferName = "image_offer";
export var TemplateVariableImageSkuName = "image_sku";
export var TemplateVariableImageUrlName = "image_url";
export var TemplateVariableLocationName = "location";
export var TemplateVariableCapturePrefixName = "capture_name_prefix";
export var TemplateVariableScriptRelativePathName = "script_relative_path";
export var TemplateVariableScriptArgumentsName = "script_arguments";
export var TemplateVariablePackagePathName = "package_path";
export var TemplateVariablePackageName = "package_name";
export var TemplateVariableSubscriptionIdName = "subscription_id";
export var TemplateVariableClientIdName = "client_id";
export var TemplateVariableClientSecretName = "client_secret";
export var TemplateVariableTenantIdName = "tenant_id";
export var TemplateVariableObjectIdName = "object_id";
export var TemplateVariableSkipCleanName = "skip_clean";
export var TemplateVariableManagedImageName = "managed_image_name"

export var PackerLogTokenImageUri = "OSDiskUri";
export var PackerLogTokenStorageLocation = "StorageAccountLocation";
export var PackerLogTokenManagedResourceGroupName = "ManagedImageResourceGroupName";
export var PackerLogTokenManagedImageName = "ManagedImageName";
export var PackerLogTokenManagedImageLocation = "ManagedImageLocation";
export var PackerLogTokenManagedImageId = "ManagedImageId";

export var OutputVariableImageUri = "imageUri";
export var OutputVariableImageId = "imageId";

export var CurrentSupportedPackerVersionString = "1.2.4";
export var PackerDownloadUrlFormat = "https://releases.hashicorp.com/packer/%s/packer_%s_%s.zip"

export var TemplateTypeCustom = "custom";
export var TemplateTypeBuiltin = "builtin"
export var BaseImageSourceCustomVhd = "customVhd";
export var BaseImageSourceDefault = "default";
export var BaseImageManagedSourceDefault = "default.managed";
export var BaseImageManagedSourceCustomVhd = "customVhd.managed";
export var BuiltinWindowsDefaultImageTemplateKey = BuiltInTemplateOSTypeWindows + '-' + BaseImageSourceDefault;
export var BuiltinWindowsCustomImageTemplateKey = BuiltInTemplateOSTypeWindows + '-' + BaseImageSourceCustomVhd;
export var BuiltinLinuxDefaultImageTemplateKey = BuiltInTemplateOSTypeLinux + '-' + BaseImageSourceDefault;
export var BuiltinLinuxCustomImageTemplateKey = BuiltInTemplateOSTypeLinux + '-' + BaseImageSourceCustomVhd;
export var BuiltinManagedWindowsDefaultImageTemplateKey = BuiltInTemplateOSTypeWindows + '-' + BaseImageManagedSourceDefault;
export var BuiltinManagedWindowsCustomImageTemplateKey = BuiltInTemplateOSTypeWindows + '-' + BaseImageManagedSourceCustomVhd;
export var BuiltinManagedLinuxDefaultImageTemplateKey = BuiltInTemplateOSTypeLinux + '-' + BaseImageManagedSourceDefault;
export var BuiltinManagedLinuxCustomImageTemplateKey = BuiltInTemplateOSTypeLinux + '-' + BaseImageManagedSourceCustomVhd;