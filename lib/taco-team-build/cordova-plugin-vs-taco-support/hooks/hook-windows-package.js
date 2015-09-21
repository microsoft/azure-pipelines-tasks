/*
  Copyright (c) Microsoft. All rights reserved.  
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/

var fs, path, et, Q;

module.exports = function(context) {

    // Skip processing if being called from within Visual Studio or MSBuild
    if (process.env["VisualStudioEdition"]) {
        return;
    }

    fs = require("fs");
    path = require("path");
    et = context.requireCordovaModule("elementtree");
    Q = context.requireCordovaModule("q");

    var overrides = getManifestOverrides(path.join(context.opts.projectRoot, "config.xml"));
    var winPlatDir = path.join(context.opts.projectRoot, "platforms", "windows");
       
    // Update all JS proj files with store cert from <vs:> elements in config.xml 
    var jsProjFiles = fs.readdirSync(winPlatDir).filter(function (e) { return e.match(/\.jsproj$/i); });
    jsProjFiles.forEach(function (jsProjFile) {
        var jsProjPath = path.join(winPlatDir, jsProjFile);
        var jsProjXml = parseXml(jsProjPath);
        
        if (overrides.certFile) {
            var existingRef = jsProjXml.find(".//None[@Include=\"" + overrides.certFile + "\"]");
            if (!existingRef) {
                var itemGroup = new et.Element("ItemGroup");
                var none = new et.Element("None");
                none.attrib.Include = overrides.certFile;
                itemGroup.append(none);
                jsProjXml.getroot().append(itemGroup);
            }

            var existingKey = false;
            var keyElement = jsProjXml.find(".//PackageCertificateKeyFile");
            if (!keyElement) {
                var newGroup = new et.Element("PropertyGroup");
                keyElement = new et.Element("PackageCertificateKeyFile");
                keyElement.text = overrides.certFile;
                newGroup.append(keyElement);
                jsProjXml.getroot().append(newGroup);
            } 
            keyElement.text = overrides.certFile;
        }

        // Due to two cordova bugs, we need to inject MSBuild pre-build event to set Id correctly
        // Bug #1 is that the name and Id are updated during compile instead of prepare, 
        // Bug #2 is that the Applicaiton/@Id is set incorrectly which prevents us from setting platforms/windows/config.xml.
        if (overrides.id) {
            var eventScriptAlreadySet = false;
            var event = jsProjXml.find(".//PreBuildEvent");
            if (!event) {
                var newGroup = new et.Element("PropertyGroup");
                event = new et.Element("PreBuildEvent");
                newGroup.append(event);
                jsProjXml.getroot().append(newGroup);
            }
            event.attrib.Condition = "";
            // Find cordova-lib's node_modules path so we can acquire elementtree since we won't have the context object.
            var cordovaModulePath;
            module.parent.paths.forEach(function (modulePath) {
                if (modulePath.lastIndexOf("cordova-lib\\node_modules") == modulePath.length - 24) {
                    cordovaModulePath = modulePath;
                }
            });
            event.text = "\n cd /d $(MSBuildThisFileDirectory)\n node -e \"require(\'" + context.scriptLocation.replace(/\\/g, "\\\\") + "\').applyManifestOverrides(\'" + winPlatDir.replace(/\\/g, "\\\\") + "\', '" + cordovaModulePath.replace(/\\/g, "\\\\") + "');\"\n";
        }

        if (overrides.locale) {
            var defaultLangProp = jsProjXml.find(".//DefaultLanguage");
            defaultLangProp.text = overrides.locale;
        }

        fs.writeFileSync(jsProjPath, jsProjXml.write({ indent: 4 }), "utf-8");
    });
}

function parseXml(filename) {
    return new et.ElementTree(et.XML(fs.readFileSync(filename, "utf-8").replace(/^\uFEFF/, "")));
}

function getManifestOverrides(file) {
    var xml = parseXml(file);
    var overrides = {};
    var locale = xml.getroot().attrib.defaultLocale || null;
    if (locale) overrides.locale = locale;
    var desc = xml.find("description");
    if (desc) overrides.description = (desc && desc.text) || "";

    var platformValues = xml.findall("vs:platformSpecificValues/vs:platformSpecificWidget");
    platformValues.forEach(function (platVal) {
        if (platVal.attrib.platformName === "windows") {
            overrides.id = platVal.attrib.id;
            overrides.version = platVal.attrib.version;
            var name = platVal.find("vs:name");
            overrides.name = (name && name.text);
            var author = platVal.find("vs:author");
            overrides.author = (author && author.text);
            var publisherId = platVal.find("vs:publisherId");
            overrides.publisherId = (publisherId && publisherId.text);
            var certFile = platVal.find("vs:certFile");
            overrides.certFile = (certFile && certFile.text);
            var packageOutputPath = platVal.find("vs:packageOutputPath");
            overrides.packageOutputPath = (packageOutputPath && packageOutputPath.text);
            return overrides;
        }
    });

    return overrides;
}

// Update manifests - Need to do this as a pre-build hook
function applyManifestOverrides(winPlatDir, cordovaModulePath) {

    // If called from an MSBuild PreBuildEvent, require our node modules
    if (cordovaModulePath) {
        path = require('path');
        fs = require('fs');
        et = require(path.join(cordovaModulePath, "elementtree"));
    }

    var overrides = getManifestOverrides(path.join(winPlatDir, "config.xml"));

    var manifests = fs.readdirSync(winPlatDir).filter(function (e) { return e.match(/\.appxmanifest$/i); });
    manifests.forEach(function (manifest) {
        var manifestPath = path.join(winPlatDir, manifest);
        var manifestXml = parseXml(manifestPath);

        var identityEl = manifestXml.find(".//Identity");
        if (identityEl) {
            if (overrides.id) identityEl.attrib.Name = overrides.id;
            if (overrides.publisherId) identityEl.attrib.Publisher = overrides.publisherId;
            if (overrides.version) identityEl.attrib.Version = overrides.version;
        }

        // Update name and description 
        var visualEls = manifestXml.find(".//VisualElements") || manifestXml.find(".//m2:VisualElements") || manifestXml.find(".//m3:VisualElements") || manifestXml.find(".//uap:VisualElements");
        if (visualEls) {
            if (overrides.name) visualEls.attrib.DisplayName = overrides.name;
            if (overrides.description) visualEls.attrib.Description = overrides.description.replace(/[\r\n]+/g, "").trim();
        }

        // Update properties
        var props = manifestXml.find(".//Properties");
        if (props) {
            var displayNameEl = props.find(".//DisplayName");
            if (overrides.name && displayNameEl) displayNameEl.text = overrides.name;
            var publisherNameEl = props.find(".//PublisherDisplayName");
            if (overrides.author && publisherNameEl) publisherNameEl.text = overrides.author;
        }

        //Write out manifest
        fs.writeFileSync(manifestPath, manifestXml.write({ indent: 4 }), "utf-8");
    });
}

module.exports.applyManifestOverrides = applyManifestOverrides;

