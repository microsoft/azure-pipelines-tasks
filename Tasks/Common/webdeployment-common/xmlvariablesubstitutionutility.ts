import Q = require('q');
import tl = require('vsts-task-lib/task');
import fs = require('fs');

var ltx = require("ltx");
var varUtility = require ('./variableutility.js');
var ltxdomutility = require("./ltxdomutility.js");
var fileEncoding = require('./fileencoding.js');

export async function substituteAppSettingsVariables(folderPath) {
    var configFiles = tl.findMatch(folderPath, "**/*.config");
    var variableMap = varUtility.getVariableMap();
    var tags = ["applicationSettings", "appSettings", "connectionStrings", "configSections"];
    for(var configFile of configFiles) {
        await substituteXmlVariables(configFile, tags, variableMap);
    }
}

export async function substituteXmlVariables(configFile, tags, variableMap){
    if(!tl.exist(configFile)) {
        throw new Error(tl.loc("Configfiledoesntexists", configFile));
    }
    if( !tl.stats(configFile).isFile()) {
        return;
    }
    tl.debug("Initiated variable substitution in config file : " + configFile);
    var fileBuffer: Buffer = fs.readFileSync(configFile);
    var fileEncodeType = fileEncoding.detectFileEncoding(configFile, fileBuffer);
    var webConfigContent: string = fileBuffer.toString(fileEncodeType[0]);
    if(fileEncodeType[1]) {
        webConfigContent = webConfigContent.slice(1);
    }
    var xmlDocument;
    try{
        xmlDocument = ltxdomutility.initializeDOM(webConfigContent);
    } catch(error){
        tl.debug("Unable to parse file : " + configFile);
        tl.debug(error);
        return;
    }
    for(var index in tags) {
        var tag =  tags[index];
        var nodes = ltxdomutility.getElementsByTagName(tag); 
        if(nodes.length == 0) {
            tl.debug("Unable to find node with tag '" + tag + "' in provided xml file.");
            continue;
        }
        for(var i=0; i<nodes.length; i++) {
            var xmlNode = nodes[i];
            if(varUtility.isObject(xmlNode)){
                tl.debug("Processing substitution for xml node : " + xmlNode.name);
                try {
                    if(xmlNode.name == "configSections") {
                        await updateXmlConfigNodeAttribute(xmlDocument, xmlNode, variableMap);
                    } else {
                        await updateXmlNodeAttribute(xmlNode, variableMap);
                    }
                } catch (error){
                    tl.debug("Error occurred while processing xml node : " + xmlNode.name);
                    tl.debug(error);
                }
            }  
        }
    }
    var domContent = (fileEncodeType[1]?'\uFEFF':'') + ltxdomutility.getContentWithHeader(xmlDocument);
    fs.writeFile(configFile, domContent, fileEncodeType[0], function(error) {
        if (error) {
            throw new Error(tl.loc("Failedtowritetoconfigfilewitherror",configFile, error));
        } else {
            tl.debug("Config file " + configFile + " updated.");
        }
    });
    
}

async function updateXmlConfigNodeAttribute(xmlDocument, xmlNode, variableMap) {
    var sections = ltxdomutility.getChildElementsByTagName(xmlNode, "section");
    for(var i=0; i < sections.length; i++) {
        var section  = sections[i];
        if(varUtility.isObject(section)){
            var sectionName = sections[i].attr('name');
            if(!varUtility.isEmpty(sectionName)) {
                var customSectionNodes = ltxdomutility.getElementsByTagName(sectionName);
                if( customSectionNodes.length != 0) {
                    var customNode = customSectionNodes[0];
                    await updateXmlNodeAttribute(customNode, variableMap);
                }
            }
        }
    }
}

async function updateXmlNodeAttribute(xmlDomNode, variableMap)
{

    if (varUtility.isEmpty(xmlDomNode) || !varUtility.isObject(xmlDomNode) || xmlDomNode.name == "#comment") {
        tl.debug("Provided node is empty or a comment.");
        return;
    }
    var xmlDomNodeAttributes = xmlDomNode.attrs;	
    for(var attributeName in xmlDomNodeAttributes) {
        var attributeNameValue = (attributeName === "key") ? xmlDomNodeAttributes[attributeName] : attributeName;
        var attributeName = (attributeName === "key") ? "value" : attributeName;
        if(variableMap[attributeNameValue]) {
            xmlDomNode.attr(attributeName, variableMap[attributeNameValue]);
        }
    }
    var children = xmlDomNode.children;
    for(var i=0; i < children.length; i++) {
        var childNode = children[i];
        if(varUtility.isObject(childNode)) {
            updateXmlNodeAttribute(childNode, variableMap);
        }
    }
}