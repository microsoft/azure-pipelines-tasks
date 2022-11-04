import * as fs from "fs";
import * as ltx from "ltx";

import * as tl from "azure-pipelines-task-lib/task";

import { INuGetXmlHelper } from "./INuGetXmlHelper";

export class NuGetXmlHelper implements INuGetXmlHelper {
    constructor(private _nugetConfigPath: string) {
    }

    public SetApiKeyInNuGetConfig(source: string, apiKey: string): void {
        throw new Error(tl.loc("Error_ApiKeyNotSupported"));
    }

    public AddSourceToNuGetConfig(name: string, source: string, username?: string, password?: string): void {
        NuGetXmlHelper._updateXmlFile(this._nugetConfigPath, (xml: any): any => {
            if (xml) {
                NuGetXmlHelper._validateXmlIsConfiguration(xml);
                let xmlPackageSources = NuGetXmlHelper._getOrCreateLastElement(xml, "packageSources");
                let xmlSource = xmlPackageSources.c("add", {
                    key: name,
                    value: source
                });

                if (username || password) {
                    if (!username || !password) {
                        tl.debug("Adding NuGet source with username and password, but one of them is missing.");
                    }

                    xml = this._addCredentialsToSource(xml, name, username, password);
                }
            }

            return xml;
        });
    }

    public RemoveSourceFromNuGetConfig(name: string): void {
        NuGetXmlHelper._updateXmlFile(this._nugetConfigPath, (xml: any): any => {
            if (xml) {
                NuGetXmlHelper._validateXmlIsConfiguration(xml);
                let xmlSources = xml.getChildrenByFilter((child: any): boolean => {
                    return typeof(child) === "object" &&
                           child.getName().toLowerCase() === "add" &&
                           child.up().getName().toLowerCase() === "packagesources" &&
                           child.attrs.key === name;
                }, true);

                xmlSources.forEach((xmlSource: any): void => {
                    xmlSource.up().remove(xmlSource);
                });

                xml = this._removeSourceCredentials(xml, name);
            }

            return xml;
        });
    }

    private _addCredentialsToSource(xml: any, name: string, username: string, password: string): any {
        if (xml) {
            const xmlSourceCredentials = NuGetXmlHelper._getOrCreateLastElement(xml, "packageSourceCredentials");
            const encodedName = NuGetXmlHelper._nuGetEncodeElementName(name);
            const authTypesVar = "ValidAuthenticationTypes_" + encodedName;
            const xmlFeedName = xmlSourceCredentials.c(encodedName);

            let authTypes = tl.getVariable(authTypesVar);
            if(!authTypes) {
                if(username !== "VssSessionToken") {
                    console.log(tl.loc("Info_BasicCredRestriction", authTypesVar, 'negotiate,ntlm'));
                }

                authTypes = 'basic';
            }

            xmlFeedName.c("add", {
                key: "Username",
                value: username
            });
            xmlFeedName.c("add", {
                key: "ClearTextPassword",
                value: password
            });
            xmlFeedName.c("add", {
                key: "ValidAuthenticationTypes",
                value: authTypes
            });
        }

        return xml;
    }

    private _removeSourceCredentials(xml: any, name: string): any {
        if (xml) {
            let xmlSourceCredentials = xml.getChildrenByFilter((child: any): boolean => {
                return typeof(child) === "object" &&
                       child.getName() === NuGetXmlHelper._nuGetEncodeElementName(name) &&
                       child.up().getName().toLowerCase() === "packagesourcecredentials";
            }, true);

            xmlSourceCredentials.forEach((xmlCredentials) => {
                xmlCredentials.up().remove(xmlCredentials);
            });
        }

        return xml;
    }

    /**
     * Validates the xml element is a configuration element
     * @throws Will throw an error if the xml is not a configuration element
     * @param xml Xml Element
     */
    private static _validateXmlIsConfiguration(xml: any): void {
        if (xml) {
            if (xml.getName().toLowerCase() !== "configuration") {
                throw Error(tl.loc("Error_ExpectedConfigurationElement"));
            }
        }
    }

    /**
     * Gets the last element in xml that matches elementName. If no existing element is found,
     * one will be created on the root of xml
     * @param xml Xml Element to search
     * @param elementName Element name to return or create
     */
    private static _getOrCreateLastElement(xml: any, elementName: string): any {
        if (xml) {
            let xmlElements = xml.getChildren(elementName);
            if (!xmlElements || xmlElements.length === 0) {
                xmlElements = [xml.c(elementName)];
            }

            return xmlElements[xmlElements.length - 1];
        }
    }

    private static _updateXmlFile(xmlPath: string, updateFn: (xml: any) => any): void {
        let xmlString = fs.readFileSync(xmlPath).toString();

        // strip BOM; xml parser doesn't like it
        if (xmlString.charCodeAt(0) === 0xFEFF) {
            xmlString = xmlString.substr(1);
        }

        let xml = ltx.parse(xmlString);
        xml = updateFn(xml);
        fs.writeFileSync(xmlPath, xml.root().toString());
    }

    private static _nuGetEncodeElementName(name: string): string {
        if (!name || name.length === 0) {
            return name;
        }

        // replace the following
        const invalidCharacters = [" ", ":"];
        for (let i = 1; i < name.length; i++) {
            if (invalidCharacters.indexOf(name[i]) >= 0) {
                name = name.substr(0, i) + NuGetXmlHelper._nuGetEncodeCharater(name[i]) + name.substr(i + 1);
            }
        }

        // if the first character is a number, encode it
        if (isNaN(parseInt(name.charAt(0)))) {
            return name;
        }

        let firstCharHex = NuGetXmlHelper._nuGetEncodeCharater(name[0]);
        return firstCharHex + name.substr(1);
    }

    private static _nuGetEncodeCharater(char: string): string {
        let hexValue = char.charCodeAt(0).toString(16);
        // pad
        while (hexValue.length < 4) {
            hexValue = "0" + hexValue;
        }

        return `_x${hexValue}_`;
    }
}
