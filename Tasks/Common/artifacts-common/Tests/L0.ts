import { packagingAccessMappingUtilsTests } from "./packagingAccessMappingUtilsTests";
import { credentialProviderUtilsTests } from "./credentialProviderUtilsTests";
import { serviceConnectionUtilsTests } from "./serviceConnectionUtilsTests";

describe("artifacts-common suite", function() {
    describe("packagingAccessMappingUtils", packagingAccessMappingUtilsTests);
    describe("credentialProviderUtils", credentialProviderUtilsTests);
    describe("serviceConnectionUtils", serviceConnectionUtilsTests);
});
