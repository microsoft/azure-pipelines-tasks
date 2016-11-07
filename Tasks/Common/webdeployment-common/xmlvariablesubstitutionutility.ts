import Q = require('q');
import tl = require('vsts-task-lib/task');
import fs = require('fs');

var ltx = require("ltx");
var utility = require ('./utility.js');
var ltxdomutility = require("./ltxdomutility.js");
var fileEncoding = require('./fileencoding.js');

export async function substituteAppSettingsVariables(folderPath) {
    var configFiles = tl.glob(folderPath + "/**/*config");
    var tags = ["applicationSettings", "appSettings", "connectionStrings", "configSections"];
    for(var index in configFiles) {
        await substituteXmlVariables(configFiles[index], tags);
    }
}

async function substituteXmlVariables(configFile, tags){
    if(!tl.exist(configFile)) {
        throw new Error(tl.loc("Configfiledoesntexists", configFile));
    }
    if( !tl.stats(configFile).isFile()) {
        return;
    }
    tl.debug(tl.loc("Initiatedvariablesubstitutioninconfigfile", configFile));
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
            tl.debug(tl.loc("Unabletofindnodewithtaginprovidedxmlfile",tag));
            continue;
        }
        for(var i=0; i<nodes.length; i++) {
            var xmlNode = nodes[i];
            if(utility.isObject(xmlNode)){
                tl.debug(tl.loc("Processingsubstitutionforxmlnode", xmlNode.name));
                try {
                    if(xmlNode.name == "configSections") {
                        await updateXmlConfigNodeAttribute(xmlDocument, xmlNode);
                    } else {
                        await updateXmlNodeAttribute(xmlNode);
                    }
                } catch (error){
                    tl.debug(tl.loc("Erroroccurredwhileprocessingxmlnode", xmlNode.name));
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
            tl.debug(tl.loc("Configfileupdated",configFile));
        }
    });
    
}

async function updateXmlConfigNodeAttribute(xmlDocument, xmlNode) {
    var sections = ltxdomutility.getChildElementsByTagName(xmlNode, "section");
    for(var i=0; i < sections.length; i++) {
        var section  = sections[i];
        if(utility.isObject(section)){
            var sectionName = sections[i].attr('name');
            if(!utility.isEmpty(sectionName)) {
                var customSectionNodes = ltxdomutility.getElementsByTagName(sectionName);
                if( customSectionNodes.length != 0) {
                    var customNode = customSectionNodes[0];
                    await updateXmlNodeAttribute(customNode);
                }
            }
        }
    }
}

async function updateXmlNodeAttribute(xmlDomNode)
{

    if (utility.isEmpty(xmlDomNode) || !utility.isObject(xmlDomNode) || xmlDomNode.name == "#comment") {
        tl.debug(tl.loc("Providednodeisemptyorcomment"));
        return;
    }
    var xmlDomNodeAttributes = xmlDomNode.attrs;	
    for(var attributeName in xmlDomNodeAttributes) {
        if(attributeName != "key") {
            if(!utility.isPredefinedVariable(attributeName)) {
                var taskContextVariableValue = tl.getVariable(attributeName);
                if(taskContextVariableValue) {
                     xmlDomNode.attr(attributeName, taskContextVariableValue);
                }
            }
        }
        else {
            attributeName = xmlDomNodeAttributes[attributeName];
            if(!utility.isPredefinedVariable(attributeName)) {
                var taskContextVariableValue = tl.getVariable(attributeName);
                if(taskContextVariableValue) {
                     xmlDomNode.attr("value", taskContextVariableValue);
                }
            }
        }
    }

    var children = xmlDomNode.children;
    for(var i=0; i < children.length; i++) {
        var childNode = children[i];
        if(!utility.isEmpty(childNode) && typeof(childNode) == 'object') {
            updateXmlNodeAttribute(childNode);
        }
    }
}