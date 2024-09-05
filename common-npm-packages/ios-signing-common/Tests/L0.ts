import { getTempKeychainPathTest } from "./L0GetTempKeychainPath";
import { getDefaultKeychainPathTest } from "./L0GetDefaultKeychainPath";
import { unlockKeychainTest } from "./L0UnlockKeychain";
import { deleteKeychainTest } from "./L0DeleteKeychain";
import { deleteCertTest } from "./L0DeleteCert";
import { getBundleIdFromPlistTest } from "./L0GetBundleIdFromPlist";
import { findSigningIdentityTest } from "./L0FindSigningIdentity";
import { deleteProvisioningProfileTest } from "./L0DeleteProvisioningProfile";
import { installCertInTemporaryKeychainTest } from "./L0InstallCertInTemporaryKeychain";    
import { getP12PrivateKeyNameTest } from "./L0GetP12PrivateKeyName";
import { getP12PropertiesTest } from "./L0GetP12Properties";
import { getOSProvisioningProfileTypeTest } from "./L0GetmacOSProvisioningProfileType"
import { getCloudEntitlementTest } from "./L0GetCloudEntitlement";
import { getProvisioningProfileNameTest } from "./L0GetProvisioningProfileName";

describe("artifacts-common suite", async function() {
    describe("getTempKeychainPath", getTempKeychainPathTest);

    describe("getDefaultKeychainPath", getDefaultKeychainPathTest);

    describe("unlockKeychain", unlockKeychainTest);

    describe("deleteKeychain", deleteKeychainTest);

    describe("deleteCert", deleteCertTest);

    describe("getBundleIdFromPlist", getBundleIdFromPlistTest);

    describe("findSigningIdentity", findSigningIdentityTest);

    describe("deleteProvisioningProfile", deleteProvisioningProfileTest);

    describe("installCertInTemporaryKeychain", installCertInTemporaryKeychainTest );

    describe("getP12PrivateKeyName", getP12PrivateKeyNameTest);

    describe("getP12Properties", getP12PropertiesTest);

    describe("getOSProvisioningProfileType", getOSProvisioningProfileTypeTest);

    describe("getCloudEntitlement", getCloudEntitlementTest);

    describe("getProvisioningProfileName", getProvisioningProfileNameTest);
});
