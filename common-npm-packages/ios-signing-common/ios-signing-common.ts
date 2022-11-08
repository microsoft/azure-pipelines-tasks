import path = require('path');
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

tl.setResourcePath(path.join(__dirname, 'module.json'));

/**
 * Creates a temporary keychain and installs the P12 cert in the temporary keychain
 * @param keychainPath the path to the keychain file
 * @param keychainPwd the password to use for unlocking the keychain
 * @param p12CertPath the P12 cert to be installed in the keychain
 * @param p12Pwd the password for the P12 cert
 * @param useKeychainIfExists Pass false to delete and recreate a preexisting keychain
 * @param skipPartitionIdAclSetup Skip partition_id ACL set up for imported private key
 */
export async function installCertInTemporaryKeychain(keychainPath: string, keychainPwd: string, p12CertPath: string, p12Pwd: string, useKeychainIfExists: boolean, skipPartitionIdAclSetup?: boolean): Promise<void> {
    let setupKeychain: boolean = true;

    if (useKeychainIfExists && tl.exist(keychainPath)) {
        setupKeychain = false;
    }

    if (setupKeychain) {
        //delete keychain if exists
        await deleteKeychain(keychainPath);

        //create keychain
        let createKeychainCommand: ToolRunner = tl.tool(tl.which('security', true));
        createKeychainCommand.arg(['create-keychain', '-p', keychainPwd, keychainPath]);
        await createKeychainCommand.exec();

        //update keychain settings, keep keychain unlocked for 6h = 21600 sec, which is the job timeout for paid hosted VMs
        let keychainSettingsCommand: ToolRunner = tl.tool(tl.which('security', true));
        keychainSettingsCommand.arg(['set-keychain-settings', '-lut', '21600', keychainPath]);
        await keychainSettingsCommand.exec();
    }

    //unlock keychain
    await unlockKeychain(keychainPath, keychainPwd);

    //import p12 cert into the keychain
    let importP12Command: ToolRunner = tl.tool(tl.which('security', true));
    if (!p12Pwd) {
        // if password is null or not defined, set it to empty
        p12Pwd = '';
    }
    importP12Command.arg(['import', p12CertPath, '-P', p12Pwd, '-A', '-t', 'cert', '-f', 'pkcs12', '-k', keychainPath]);
    await importP12Command.exec();

    //If we imported into a pre-existing keychain (e.g. login.keychain), set the partition_id ACL for the private key we just imported
    //so codesign won't prompt to use the key for signing. This isn't necessary for temporary keychains, at least on High Sierra.
    //See https://stackoverflow.com/questions/39868578/security-codesign-in-sierra-keychain-ignores-access-control-settings-and-ui-p
    if (!setupKeychain && !skipPartitionIdAclSetup) {
        const privateKeyName: string = await getP12PrivateKeyName(p12CertPath, p12Pwd);
        await setKeyPartitionList(keychainPath, keychainPwd, privateKeyName);
    }

    //list the keychains to get current keychains in search path
    let listAllOutput: string;
    let listAllCommand: ToolRunner = tl.tool(tl.which('security', true));
    listAllCommand.arg(['list-keychain', '-d', 'user']);
    listAllCommand.on('stdout', function (data) {
        if (data) {
            if (listAllOutput) {
                listAllOutput = listAllOutput.concat(data.toString().trim());
            } else {
                listAllOutput = data.toString().trim();
            }
        }
    })

    await listAllCommand.exec();

    let allKeychainsArr: string[] = [];
    tl.debug('listAllOutput = ' + listAllOutput);

    //parse out all the existing keychains in search path
    if (listAllOutput) {
        allKeychainsArr = listAllOutput.split(/[\n\r\f\v]/gm);
    }

    //add the keychain to list path along with existing keychains if it is not in the path
    if (listAllOutput && listAllOutput.indexOf(keychainPath) < 0) {
        let listAddCommand: ToolRunner = tl.tool(tl.which('security', true));
        listAddCommand.arg(['list-keychain', '-d', 'user', '-s', keychainPath]);
        for (var i: number = 0; i < allKeychainsArr.length; i++) {
            listAddCommand.arg(allKeychainsArr[i].trim().replace(/"/gm, ''));
        }

        await listAddCommand.exec();
    }

    let listVerifyOutput: string;
    let listVerifyCommand: ToolRunner = tl.tool(tl.which('security', true));
    listVerifyCommand.arg(['list-keychain', '-d', 'user']);
    listVerifyCommand.on('stdout', function (data) {
        if (data) {
            if (listVerifyOutput) {
                listVerifyOutput = listVerifyOutput.concat(data.toString().trim());
            } else {
                listVerifyOutput = data.toString().trim();
            }
        }
    })

    await listVerifyCommand.exec();

    if (!listVerifyOutput || listVerifyOutput.indexOf(keychainPath) < 0) {
        throw tl.loc('TempKeychainSetupFailed');
    }
}

/**
 * Finds an iOS codesigning identity in the specified keychain
 * @param keychainPath
 * @returns {string} signing identity found
 */
export async function findSigningIdentity(keychainPath: string) {
    let signIdentity: string;
    let findIdentityCmd: ToolRunner = tl.tool(tl.which('security', true));
    findIdentityCmd.arg(['find-identity', '-v', '-p', 'codesigning', keychainPath]);
    findIdentityCmd.on('stdout', function (data) {
        if (data) {
            let matches = data.toString().trim().match(/"(.+)"/g);
            tl.debug('signing identity data = ' + matches);
            if (matches && matches[0]) {
                signIdentity = matches[0].replace(/"/gm, '');
                tl.debug('signing identity data trimmed = ' + signIdentity);
            }
        }
    })

    await findIdentityCmd.exec();
    if (signIdentity) {
        tl.debug('findSigningIdentity = ' + signIdentity);
        return signIdentity;
    } else {
        throw tl.loc('SignIdNotFound');
    }
}

/**
 * Get Cloud entitlement type Production or Development according to the export method - if entitlement doesn't exists in provisioning profile returns null
 * @param provisioningProfilePath
 * @param exportMethod
 * @returns {string}
 */
export async function getCloudEntitlement(provisioningProfilePath: string, exportMethod: string): Promise<string> {
    //find the provisioning profile details
    let provProfileDetails: string;
    const getProvProfileDetailsCmd: ToolRunner = tl.tool(tl.which('security', true));
    getProvProfileDetailsCmd.arg(['cms', '-D', '-i', provisioningProfilePath]);
    getProvProfileDetailsCmd.on('stdout', function (data) {
        if (data) {
            if (provProfileDetails) {
                provProfileDetails = provProfileDetails.concat(data.toString().trim().replace(/[,\n\r\f\v]/gm, ''));
            } else {
                provProfileDetails = data.toString().trim().replace(/[,\n\r\f\v]/gm, '');
            }
        }
    });

    await getProvProfileDetailsCmd.exec();

    let tmpPlist: string;
    if (provProfileDetails) {
        //write the provisioning profile to a plist
        tmpPlist = '_xcodetasktmp.plist';
        tl.writeFile(tmpPlist, provProfileDetails);
    } else {
        throw tl.loc('ProvProfileDetailsNotFound', provisioningProfilePath);
    }

    //use PlistBuddy to figure out if cloud entitlement exists.
    const cloudEntitlement: string = await printFromPlist('Entitlements:com.apple.developer.icloud-container-environment', tmpPlist);

    //delete the temporary plist file
    const deletePlistCommand: ToolRunner = tl.tool(tl.which('rm', true));
    deletePlistCommand.arg(['-f', tmpPlist]);
    await deletePlistCommand.exec();

    if (!cloudEntitlement) {
        return null;
    }

    tl.debug('Provisioning Profile contains cloud entitlement');
    return (exportMethod === 'app-store' || exportMethod === 'enterprise' || exportMethod === 'developer-id')
                ? "Production"
                : "Development";
}

/**
 * Find the UUID and Name of the provisioning profile and install the profile
 * @param provProfilePath
 * @returns { provProfileUUID, provProfileName }
 */
export async function installProvisioningProfile(provProfilePath: string) : Promise<{ provProfileUUID: string, provProfileName: string }> {
    //find the provisioning profile UUID
    let provProfileDetails: string;
    let getProvProfileDetailsCmd: ToolRunner = tl.tool(tl.which('security', true));
    getProvProfileDetailsCmd.arg(['cms', '-D', '-i', provProfilePath]);
    getProvProfileDetailsCmd.on('stdout', function (data) {
        if (data) {
            if (provProfileDetails) {
                provProfileDetails = provProfileDetails.concat(data.toString().trim().replace(/[,\n\r\f\v]/gm, ''));
            } else {
                provProfileDetails = data.toString().trim().replace(/[,\n\r\f\v]/gm, '');
            }
        }
    })
    await getProvProfileDetailsCmd.exec();

    let tmpPlist: string;
    if (provProfileDetails) {
        //write the provisioning profile to a plist
        tmpPlist = '_xcodetasktmp.plist';
        tl.writeFile(tmpPlist, provProfileDetails);
    } else {
        throw tl.loc('ProvProfileDetailsNotFound', provProfilePath);
    }

    //use PlistBuddy to figure out the UUID
    let provProfileUUID: string;
    let plist = tl.which('/usr/libexec/PlistBuddy', true);
    let plistTool: ToolRunner = tl.tool(plist);
    plistTool.arg(['-c', 'Print UUID', tmpPlist]);
    plistTool.on('stdout', function (data) {
        if (data) {
            provProfileUUID = data.toString().trim();
        }
    })
    await plistTool.exec();

    //use PlistBuddy to figure out the Name
    let provProfileName: string;
    plistTool = tl.tool(plist);
    plistTool.arg(['-c', 'Print Name', tmpPlist]);
    plistTool.on('stdout', function (data) {
        if (data) {
            provProfileName = data.toString().trim();
        }
    })
    await plistTool.exec();

    //delete the temporary plist file
    let deletePlistCommand: ToolRunner = tl.tool(tl.which('rm', true));
    deletePlistCommand.arg(['-f', tmpPlist]);
    await deletePlistCommand.exec();

    if (provProfileUUID) {
        //copy the provisioning profile file to ~/Library/MobileDevice/Provisioning Profiles
        tl.mkdirP(getUserProvisioningProfilesPath()); // Path may not exist if Xcode has not been run yet.
        let pathToProvProfile: string = getProvisioningProfilePath(provProfileUUID, provProfilePath);
        let copyProvProfileCmd: ToolRunner = tl.tool(tl.which('cp', true));
        copyProvProfileCmd.arg(['-f', provProfilePath, pathToProvProfile]);
        await copyProvProfileCmd.exec();

        if (!provProfileName) {
            tl.warning(tl.loc('ProvProfileNameNotFound'));
        }

        return { provProfileUUID, provProfileName };
    } else {
        throw tl.loc('ProvProfileUUIDNotFound', provProfilePath);
    }
}

/**
 * Find the Name of the provisioning profile
 * @param provProfilePath
 * @returns {string} Name
 */
export async function getProvisioningProfileName(provProfilePath: string) {
    //find the provisioning profile UUID
    let provProfileDetails: string;
    let getProvProfileDetailsCmd: ToolRunner = tl.tool(tl.which('security', true));
    getProvProfileDetailsCmd.arg(['cms', '-D', '-i', provProfilePath]);
    getProvProfileDetailsCmd.on('stdout', function (data) {
        if (data) {
            if (provProfileDetails) {
                provProfileDetails = provProfileDetails.concat(data.toString().trim().replace(/[,\n\r\f\v]/gm, ''));
            } else {
                provProfileDetails = data.toString().trim().replace(/[,\n\r\f\v]/gm, '');
            }
        }
    })
    await getProvProfileDetailsCmd.exec();

    let tmpPlist: string;
    if (provProfileDetails) {
        //write the provisioning profile to a plist
        tmpPlist = '_xcodetasktmp.plist';
        tl.writeFile(tmpPlist, provProfileDetails);
    } else {
        throw tl.loc('ProvProfileDetailsNotFound', provProfilePath);
    }

    //use PlistBuddy to figure out the Name
    let provProfileName: string = await printFromPlist('Name', tmpPlist);

    //delete the temporary plist file
    let deletePlistCommand: ToolRunner = tl.tool(tl.which('rm', true));
    deletePlistCommand.arg(['-f', tmpPlist]);
    await deletePlistCommand.exec();

    tl.debug('getProvisioningProfileName: profile name = ' + provProfileName);
    return provProfileName;
}

/**
 * Find the type of the iOS provisioning profile - app-store, ad-hoc, enterprise or development
 * @param provProfilePath
 * @returns {string} type
 */
export async function getiOSProvisioningProfileType(provProfilePath: string) {
    let provProfileType: string;
    try {
        //find the provisioning profile details
        let provProfileDetails: string;
        let getProvProfileDetailsCmd: ToolRunner = tl.tool(tl.which('security', true));
        getProvProfileDetailsCmd.arg(['cms', '-D', '-i', provProfilePath]);
        getProvProfileDetailsCmd.on('stdout', function (data) {
            if (data) {
                if (provProfileDetails) {
                    provProfileDetails = provProfileDetails.concat(data.toString().trim().replace(/[,\n\r\f\v]/gm, ''));
                } else {
                    provProfileDetails = data.toString().trim().replace(/[,\n\r\f\v]/gm, '');
                }
            }
        })
        await getProvProfileDetailsCmd.exec();

        let tmpPlist: string;
        if (provProfileDetails) {
            //write the provisioning profile to a plist
            tmpPlist = '_xcodetasktmp.plist';
            tl.writeFile(tmpPlist, provProfileDetails);
        } else {
            throw tl.loc('ProvProfileDetailsNotFound', provProfilePath);
        }

        //get ProvisionsAllDevices - this will exist for enterprise profiles
        let provisionsAllDevices: string = await printFromPlist('ProvisionsAllDevices', tmpPlist);
        tl.debug('provisionsAllDevices = ' + provisionsAllDevices);
        if (provisionsAllDevices && provisionsAllDevices.trim().toLowerCase() === 'true') {
            //ProvisionsAllDevices = true in enterprise profiles
            provProfileType = 'enterprise';
        } else {
            let getTaskAllow: string = await printFromPlist('Entitlements:get-task-allow', tmpPlist);
            tl.debug('getTaskAllow = ' + getTaskAllow);
            if (getTaskAllow && getTaskAllow.trim().toLowerCase() === 'true') {
                //get-task-allow = true means it is a development profile
                provProfileType = 'development';
            } else {
                let provisionedDevices: string = await printFromPlist('ProvisionedDevices', tmpPlist);
                if (!provisionedDevices) {
                    // no provisioned devices for non-development profile means it is an app-store profile
                    provProfileType = 'app-store';
                } else {
                    // non-development profile with provisioned devices - use ad-hoc
                    provProfileType = 'ad-hoc';
                }
            }
        }

        //delete the temporary plist file
        let deletePlistCommand: ToolRunner = tl.tool(tl.which('rm', true));
        deletePlistCommand.arg(['-f', tmpPlist]);
        await deletePlistCommand.exec();
    } catch (err) {
        tl.debug(err);
    }

    return provProfileType;
}

/**
 * Find the type of the macOS provisioning profile - app-store, developer-id or development.
 * mac-application is a fourth macOS export method, but it doesn't include signing.
 * @param provProfilePath
 * @returns {string} type
 */
export async function getmacOSProvisioningProfileType(provProfilePath: string) {
    let provProfileType: string;
    try {
        //find the provisioning profile details
        let provProfileDetails: string;
        let getProvProfileDetailsCmd: ToolRunner = tl.tool(tl.which('security', true));
        getProvProfileDetailsCmd.arg(['cms', '-D', '-i', provProfilePath]);
        getProvProfileDetailsCmd.on('stdout', function (data) {
            if (data) {
                if (provProfileDetails) {
                    provProfileDetails = provProfileDetails.concat(data.toString().trim().replace(/[,\n\r\f\v]/gm, ''));
                } else {
                    provProfileDetails = data.toString().trim().replace(/[,\n\r\f\v]/gm, '');
                }
            }
        })
        await getProvProfileDetailsCmd.exec();

        let tmpPlist: string;
        if (provProfileDetails) {
            //write the provisioning profile to a plist
            tmpPlist = '_xcodetasktmp.plist';
            tl.writeFile(tmpPlist, provProfileDetails);
        } else {
            throw tl.loc('ProvProfileDetailsNotFound', provProfilePath);
        }

        //get ProvisionsAllDevices - this will exist for developer-id profiles
        let provisionsAllDevices: string = await printFromPlist('ProvisionsAllDevices', tmpPlist);
        tl.debug('provisionsAllDevices = ' + provisionsAllDevices);
        if (provisionsAllDevices && provisionsAllDevices.trim().toLowerCase() === 'true') {
            //ProvisionsAllDevices = true in developer-id profiles
            provProfileType = 'developer-id';
        } else {
            let provisionedDevices: string = await printFromPlist('ProvisionedDevices', tmpPlist);
            if (!provisionedDevices) {
                // no provisioned devices means it is an app-store profile
                provProfileType = 'app-store';
            } else {
                // profile with provisioned devices - use development
                provProfileType = 'development';
            }
        }

        //delete the temporary plist file
        let deletePlistCommand: ToolRunner = tl.tool(tl.which('rm', true));
        deletePlistCommand.arg(['-f', tmpPlist]);
        await deletePlistCommand.exec();
    } catch (err) {
        tl.debug(err);
    }

    return provProfileType;
}

/**
 * Find the bundle identifier in the specified Info.plist
 * @param plistPath
 * @returns {string} bundle identifier
 */
export async function getBundleIdFromPlist(plistPath: string) {
    let bundleId: string = await printFromPlist('CFBundleIdentifier', plistPath);
    tl.debug('getBundleIdFromPlist bundleId = ' + bundleId);
    return bundleId;
}

/**
 * Delete specified iOS keychain
 * @param keychainPath
 */
export async function deleteKeychain(keychainPath: string): Promise<void> {
    if (tl.exist(keychainPath)) {
        let deleteKeychainCommand: ToolRunner = tl.tool(tl.which('security', true));
        deleteKeychainCommand.arg(['delete-keychain', keychainPath]);
        await deleteKeychainCommand.exec();
    }
}

/**
 * Unlock specified iOS keychain
 * @param keychainPath
 * @param keychainPwd
 */
export async function unlockKeychain(keychainPath: string, keychainPwd: string): Promise<void> {
    //unlock the keychain
    let unlockCommand: ToolRunner = tl.tool(tl.which('security', true));
    unlockCommand.arg(['unlock-keychain', '-p', keychainPwd, keychainPath]);
    await unlockCommand.exec();
}

/**
 * Delete provisioning profile with specified UUID in the user's profiles directory
 * @param uuid
 */
export async function deleteProvisioningProfile(uuid: string): Promise<void> {
    if (uuid && uuid.trim()) {
        const provProfiles: string[] = tl.findMatch(getUserProvisioningProfilesPath(), uuid.trim() + '*');
        if (provProfiles) {
            for (const provProfilePath of provProfiles) {
                console.log('Deleting provisioning profile: ' + provProfilePath);
                if (tl.exist(provProfilePath)) {
                    const deleteProfileCommand: ToolRunner = tl.tool(tl.which('rm', true));
                    deleteProfileCommand.arg(['-f', provProfilePath]);
                    await deleteProfileCommand.exec();
                }
            }
        }
    }
}

/**
 * Gets the path to the iOS default keychain
 */
export async function getDefaultKeychainPath() {
    let defaultKeychainPath: string;
    let getKeychainCmd: ToolRunner = tl.tool(tl.which('security', true));
    getKeychainCmd.arg('default-keychain');
    getKeychainCmd.on('stdout', function (data) {
        if (data) {
            defaultKeychainPath = data.toString().trim().replace(/[",\n\r\f\v]/gm, '');
        }
    })
    await getKeychainCmd.exec();
    return defaultKeychainPath;
}

/**
 * Gets the path to the temporary keychain path used during build or release
 */
export function getTempKeychainPath(): string {
    let keychainName: string = 'ios_signing_temp.keychain';
    let getTempKeychainPath: string = tl.resolve(tl.getVariable('Agent.TempDirectory'), keychainName);
    return getTempKeychainPath;
}

/**
 * Get several x509 properties from the certificate in a P12 file.
 * @param p12Path Path to the P12 file
 * @param p12Pwd Password for the P12 file
 */
export async function getP12Properties(p12Path: string, p12Pwd: string): Promise<{ fingerprint: string, commonName: string, notBefore: Date, notAfter: Date}> {
    //openssl pkcs12 -in <p12Path> -nokeys -passin pass:"<p12Pwd>" | openssl x509 -noout -fingerprint –subject -dates
    let opensslPath: string = tl.which('openssl', true);
    let openssl1: ToolRunner = tl.tool(opensslPath);
    if (!p12Pwd) {
        // if password is null or not defined, set it to empty
        p12Pwd = '';
    }
    openssl1.arg(['pkcs12', '-in', p12Path, '-nokeys', '-passin', 'pass:' + p12Pwd]);

    let openssl2: ToolRunner = tl.tool(opensslPath);
    openssl2.arg(['x509', '-sha1', '-noout', '-fingerprint', '-subject', '-dates', '-nameopt', 'utf8,sep_semi_plus_space']);
    openssl1.pipeExecOutputToTool(openssl2);

    let fingerprint: string;
    let commonName: string;
    let notBefore: Date;
    let notAfter: Date;

    function onLine(line: string) {
        if (line) {
            const tuple = splitIntoKeyValue(line);
            const key: string = tuple.key;
            const value: string = tuple.value;

            if (key === 'SHA1 Fingerprint') {
                // Example value: "BB:26:83:C6:AA:88:35:DE:36:94:F2:CF:37:0A:D4:60:BB:AE:87:0C"
                // Remove colons separating each octet.
                fingerprint = value.replace(/:/g, '').trim();
            } else if (key === 'subject') {
                // Example value1: "UID=E848ASUQZY; CN=iPhone Developer: Chris Sidi (7RZ3N927YF); OU=DJ8T2973U7; O=Chris Sidi; C=US"
                // Example value2: "UID=E848ASUQZY; CN=iPhone Developer: Chris / Sidi (7RZ3N927YF); OU=DJ8T2973U7; O=Chris Sidi; C=US"
                // Example value3: "UID=E848ASUQZY; OU=DJ8T2973U7; O=Chris Sidi; C=US; CN=iPhone Developer: Chris Sidi (7RZ3N927YF)"
                // Extract the common name.
                const matches: string[] = value.match(/CN=.*?(?=[;\r\n]|$)/);
                if (matches && matches[0]) {
                    commonName = matches[0].trim().replace("CN=", "");
                }
            } else if (key === 'notBefore') {
                // Example value: "Nov 13 03:37:42 2018 GMT"
                notBefore = new Date(value);
            } else if (key === 'notAfter') {
                notAfter = new Date(value);
            }
        }
    }

    // Concat all of stdout to avoid shearing. This can be updated to `openssl1.on('stdline', onLine)` once stdline mocking is available.
    let output = '';
    openssl1.on('stdout', (data) => {
        output = output + data.toString();
    });

    try {
        await openssl1.exec();

        // process the collected stdout.
        let line: string;
        for (line of output.split('\n')) {
            onLine(line);
        }
    } catch (err) {
        if (!p12Pwd) {
            tl.warning(tl.loc('NoP12PwdWarning'));
        }
        throw err;
    }

    tl.debug(`P12 fingerprint: ${fingerprint}`);
    tl.debug(`P12 common name (CN): ${commonName}`);
    tl.debug(`NotBefore: ${notBefore}`);
    tl.debug(`NotAfter: ${notAfter}`);

    return { fingerprint, commonName, notBefore, notAfter };
}

/**
 * Delete certificate with specified SHA1 hash (thumbprint) from a keychain.
 * @param keychainPath
 * @param certSha1Hash
 */
export async function deleteCert(keychainPath: string, certSha1Hash: string): Promise<void> {
    let deleteCert: ToolRunner = tl.tool(tl.which('security', true));
    deleteCert.arg(['delete-certificate', '-Z', certSha1Hash, keychainPath]);
    await deleteCert.exec();
}

/**
 * Get the friendly name from the private key in a P12 file.
 * @param p12Path Path to the P12 file
 * @param p12Pwd Password for the P12 file
 */
export async function getP12PrivateKeyName(p12Path: string, p12Pwd: string): Promise<string> {
    //openssl pkcs12 -in <p12Path> -nocerts -passin pass:"<p12Pwd>" -passout pass:"<p12Pwd>" | grep 'friendlyName'
    tl.debug('getting the P12 private key name');
    const opensslPath: string = tl.which('openssl', true);
    const openssl: ToolRunner = tl.tool(opensslPath);
    if (!p12Pwd) {
        // if password is null or not defined, set it to empty
        p12Pwd = '';
    }
    // since we can't suppress the private key bytes, encrypt them before we pass them to grep.
    const privateKeyPassword = p12Pwd ? p12Pwd : generatePassword();
    openssl.arg(['pkcs12', '-in', p12Path, '-nocerts', '-passin', 'pass:' + p12Pwd, '-passout', 'pass:' + privateKeyPassword]);

    //we pipe through grep so we we don't log the private key to the console.
    //even if it's encrypted, it's noise and could cause concern for some users.
    const grepPath: string = tl.which('grep', true);
    const grep: ToolRunner = tl.tool(grepPath);
    grep.arg(['friendlyName']);
    openssl.pipeExecOutputToTool(grep);

    let privateKeyName: string;
    openssl.on('stdout', function (data) {
        if (data) {
            // find the private key name
            data = data.toString().trim();

            const match = data.match(/friendlyName: (.*)/);
            if (match && match[1]) {
                privateKeyName = match[1].trim();
            }
        }
    });

    await openssl.exec();
    tl.debug('P12 private key name = ' + privateKeyName);
    if (!privateKeyName) {
        throw new Error(tl.loc('P12PrivateKeyNameNotFound', p12Path));
    }

    return privateKeyName;
}

async function printFromPlist(itemToPrint: string, plistPath: string) {
    let plist = tl.which('/usr/libexec/PlistBuddy', true);
    let plistTool: ToolRunner = tl.tool(plist);
    plistTool.arg(['-c', 'Print ' + itemToPrint, plistPath]);

    let printedValue: string;
    plistTool.on('stdout', function (data) {
        if (data) {
            printedValue = data.toString().trim();
        }
    });

    try {
        await plistTool.exec();
    } catch (err) {
        tl.debug('Exception when looking for ' + itemToPrint + ' in plist.');
        printedValue = null;
    }

    return printedValue;
}

function getProvisioningProfilePath(uuid: string, provProfilePath?: string): string {
    let profileExtension: string = '';
    if (provProfilePath) {
        profileExtension = path.extname(provProfilePath);
    }
    return tl.resolve(getUserProvisioningProfilesPath(), uuid.trim().concat(profileExtension));
}

/**
 * Set the partition_id ACL so codesign has permission to use the signing key.
 */
async function setKeyPartitionList(keychainPath: string, keychainPwd: string, privateKeyName: string) {
    // security set-key-partition-list -S apple-tool:,apple: -s -l <privateKeyName> -k <keychainPwd> <keychainPath>
    // n.b. This command could update multiple keys (e.g. an expired signing key and a newer signing key.)

    if (privateKeyName) {
        tl.debug(`Setting the partition_id ACL for ${privateKeyName}`);

        // "If you'd like to run /usr/bin/codesign with the key, "apple:" must be an element of the partition list." - security(1) man page.
        // When you sign into your developer account in Xcode on a new machine, you get a private key with partition list "apple:". However
        // "security import a.p12 -k login.keychain" results in the private key with partition list "apple-tool:". I'm preserving import's
        // "apple-tool:" and adding the "apple:" codesign needs.
        const partitionList = 'apple-tool:,apple:';

        let setKeyCommand: ToolRunner = tl.tool(tl.which('security', true));
        setKeyCommand.arg(['set-key-partition-list', '-S', partitionList, '-s', '-l', privateKeyName, '-k', keychainPwd, keychainPath]);

        // Watch for "unknown command". set-key-partition-list was added in Sierra (macOS v10.12)
        let unknownCommandErrorFound: boolean;
        let incorrectPasswordErrorFound: boolean;
        setKeyCommand.on('errline', (line: string) => {
            if (!unknownCommandErrorFound && line.includes('security: unknown command')) {
                unknownCommandErrorFound = true;
            }
        });

        try {
            await setKeyCommand.exec();
        } catch (err) {
            if (unknownCommandErrorFound) {
                // If we're on an older OS, we don't need to run set-key-partition-list.
                console.log(tl.loc('SetKeyPartitionListCommandNotFound'));
            } else {
                tl.error(err);
                throw new Error(tl.loc('SetKeyPartitionListCommandFailed'));
            }
        }
    }
}

function generatePassword(): string {
    return Math.random().toString(36);
}

function getUserProvisioningProfilesPath(): string {
    return tl.resolve(tl.getVariable('HOME'), 'Library', 'MobileDevice', 'Provisioning Profiles');
}

function splitIntoKeyValue(line: string): {key: string, value: string} {
    // Don't use `split`. The value may contain `=` (e.g. "/UID=E848ASUQZY/CN=iPhone Developer: ...")
    const index: number = line.indexOf('=');

    if (index) {
        return {key: line.substring(0, index), value: line.substring(index + 1)};
    } else {
        return undefined;
    }
}