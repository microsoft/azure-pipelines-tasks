/// <reference path="./vsts-task-lib.d.ts" />

declare module 'ios-signing-common/ios-signing-common' {

    /**
     * Gets the path to the temporary keychain path used during build or release
    */
    export function getTempKeychainPath(): string;

    /**
     * Creates a temporary keychain and installs the P12 cert in the temporary keychain
     * @param keychainPath the path to the keychain file
     * @param keychainPwd the password to use for unlocking the keychain
     * @param p12CertPath the P12 cert to be installed in the keychain
     * @param p12Pwd the password for the P12 cert
     * @param useKeychainIfExists Pass false to delete and recreate a preexisting keychain
     */
    export function installCertInTemporaryKeychain(keychainPath: string, keychainPwd: string, p12CertPath: string, p12Pwd: string, useKeychainIfExists: boolean): Promise<void>;

    /**
    * Finds an iOS codesigning identity in the specified keychain
    * @param keychainPath
    * @returns {string} signing identity found
    */
    export function findSigningIdentity(keychainPath: string): string;

    /**
     * Find the UUID and Name of the provisioning profile and install the profile
     * @param provProfilePath
     * @returns { provProfileUUID, provProfileName }
     */
    export function installProvisioningProfile(provProfilePath: string): Promise<{ provProfileUUID: string, provProfileName: string }>;

    /**
     * Find the type of the provisioning profile - development, app-store or ad-hoc
     * @param provProfilePath
     * @returns {string} type
     */
    export function getProvisioningProfileType(provProfilePath: string): string;

    /**
     * Delete specified iOS keychain
     * @param keychainPath
     */
    export function deleteKeychain(keychainPath: string): Promise<void>;

    /**
     * Unlock specified iOS keychain
     * @param keychainPath
     * @param keychainPwd
     */
    export function unlockKeychain(keychainPath: string, keychainPwd: string): Promise<void>;


    /**
     * Delete certificate with specified SHA1 hash (thumbprint) from a keychain.
     * @param keychainPath
     * @param certSha1Hash
     */
    export function deleteCert(keychainPath: string, certSha1Hash: string): Promise<void>;

    /**
     * Delete provisioning profile with specified UUID in the user's profiles directory
     * @param uuid
     */
    export function deleteProvisioningProfile(uuid: string): Promise<void>;

    /**
     * Gets the path to the iOS default keychain
     */
    export function getDefaultKeychainPath(): string;

    /**
     * Get the SHA1 hash (thumbprint) for the certificate in a P12 file.
     * @param p12Path Path to the P12 file
     * @param p12Pwd Password for the P12 file
     */
    export function getP12SHA1Hash(p12Path: string, p12Pwd: string): Promise<string>;

    /**
     * Get the common name from the certificate in a P12 file, with 'CN=' removed.
     * @param p12Path Path to the P12 file
     * @param p12Pwd Password for the P12 file
     */
    export function getP12CommonName(p12Path: string, p12Pwd: string): Promise<string>;

    /**
     * Get the friendly name from the private key in a P12 file.
     * @param p12Path Path to the P12 file
     * @param p12Pwd Password for the P12 file
     */
    export function getP12PrivateKeyName(p12Path: string, p12Pwd: string): Promise<string>;

    /**
     * Get Cloud entitlement type Production or Development according to the export method - if entitlement doesn't exists in provisioning profile returns null
     * @param provisioningProfilePath
     * @param exportMethod
     * @returns {string}
     */
    export function getCloudEntitlement(provisioningProfilePath: string, exportMethod: string): Promise<string>;
}