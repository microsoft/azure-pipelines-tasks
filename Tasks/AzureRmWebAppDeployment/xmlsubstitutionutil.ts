import Q = require('q');
import tl = require('vsts-task-lib/task');
import fs = require('fs');

var xmldom = require('xmldom');
var serializer = new xmldom.XMLSerializer;
var implementation = new xmldom.DOMImplementation;

export async function substituteVariable(folderPath) {
    var configFiles = tl.glob(folderPath+ "/**/*config");
    var tags = ["applicationSettings", "appSettings", "connectionStrings", "configSections"];
    for(var index in configFiles) {
        await substituteXmlVariables(configFiles[index], tags);
    }
}

async function substituteXmlVariables(configFile, tags){
    if(!tl.exist(configFile)) {
        throw new Error(tl.loc("Configfiledoesntexists", configFile));
    }
    if( !tl.stats(configFile).isFile()){
        return;
    }
    tl.debug(tl.loc("Initiatedvariablesubstitutioninconfigfile", configFile));
    var webConfigContent = fs.readFileSync(configFile);
    var DOMParser = require('xmldom').DOMParser;
    var xmlDocument = new DOMParser().parseFromString(webConfigContent.toString(), 'application/xml');
    for(var index in tags) {
        var tag =  tags[index];
        var nodes = xmlDocument.getElementsByTagName(tag); 
        if(nodes.length == 0) {
            tl.debug(tl.loc("Unabletofindnodewithtaginprovidedxmlfile",tag));
            continue;
        }
        for(var i=0; i<nodes.length; i++) {
            var xmlNode = nodes.item(i);
            tl.debug(tl.loc("Processingsubstitutionforxmlnode", xmlNode.localName));
            try {
                if(xmlNode.localName == "configSections") {
                    await updateXmlConfigNodeAttribute(xmlDocument, xmlNode);
                } else {
                    await updateXmlNodeAttribute(xmlNode);
                }
            } catch (error){
                tl.debug(tl.loc("Erroroccurredwhileprocessingxmlnode", xmlNode.localName));
                tl.debug(error);
            }
        }
    }
    fs.writeFile(configFile, serializer.serializeToString(xmlDocument), function(error) {
        if (error) {
            throw new Error(tl.loc("Failedtowritetoconfigfilewitherror",configFile, error));
        } else {
            console.log(tl.loc("Configfileupdated",configFile));
        }
    });
    
}

function isEmpty(object){
    if(object == null || object == "")
        return true;
    return false;
}

async function updateXmlConfigNodeAttribute(xmlDocument, xmlNode) {
    var sections = xmlNode.getElementsByTagName("section");
    for(var i=0; i < sections.length; i++) {
        var sectionName = sections[i].getAttribute('name');
        if(!isEmpty(sectionName)) {
            var customSectionNodes = xmlDocument.getElementsByTagName(sectionName);
            if( customSectionNodes.length != 0) {
                var customNode = customSectionNodes.item(0);
                await updateXmlNodeAttribute(customNode);
            }
        }
    }
}

async function updateXmlNodeAttribute(xmlDomNode) {
    if(xmlDomNode == null) {
        tl.debug(tl.loc("Providednodeisempty"));
        return;
    }
    var childNodes = xmlDomNode.childNodes;
    for(var i=0; i< childNodes.length; i++){
        var childNode = childNodes[i];
        if (isEmpty(childNode) || isEmpty(childNode.localName) || childNode.localName == "#comment") {
            continue;
        }
        var childAttributes = childNode.attributes;
        for(var j=0; j< childAttributes.length; j++){
            var attribute = childAttributes[j];
            if(!isEmpty(attribute)) {
                var taskContextVariableValue = tl.getVariable(attribute.localName);
                if(taskContextVariableValue){
                    childNode.setAttribute(attribute.localName, taskContextVariableValue);
                }
            }
        }
        var valueOfKeyAttribute = childNode.getAttribute("key");
        if(!isEmpty(valueOfKeyAttribute)) {
            var taskContextValueOfKeyAttribute = tl.getVariable(valueOfKeyAttribute);
            if(taskContextValueOfKeyAttribute) {
                childNode.setAttribute("value",taskContextValueOfKeyAttribute);
            }
        }
        if(childNode.hasChildNodes()) {
            updateXmlNodeAttribute(childNode);
        }
    }
}