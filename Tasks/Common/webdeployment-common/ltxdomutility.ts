var ltx = require("ltx");
var varUtility = require("./variableutility.js");
var Q = require('q');

var xmlDomLookUpTable = {};
var headerContent;

export function initializeDOM(xmlContent) {
    xmlDomLookUpTable = {};
    headerContent = null;
    var xmlDom = ltx.parse(xmlContent);
    buildLookUpTable(xmlDom);
    return xmlDom;
}

function readHeader(xmlContent) {
    var index = xmlContent.indexOf('\n');
    if(index > -1) {
        var firstLine = xmlContent.substring(0,index).trim();
        console.log(firstLine);
        if(firstLine.startsWith("<?") && firstLine.endsWith("?>")) {
            headerContent = firstLine;
        }
    }
}

export function getContentWithHeader(xmlDom) {
    return xmlDom ? (headerContent ? headerContent+"\n" : "") + xmlDom.root().toString() : "";
}

/**
 * Define method to create a lookup for DOM 
 */
function buildLookUpTable(node) {
    if(node){
        var nodeName = node.name;
        if(nodeName){
            nodeName = nodeName.toLowerCase();
            var listOfNodes = xmlDomLookUpTable[nodeName];
            if(listOfNodes == null ){
                listOfNodes = [];
                xmlDomLookUpTable[nodeName] = listOfNodes;
            }
            listOfNodes.push(node);
            var childNodes = node.children;
            for(var i=0 ; i < childNodes.length; i++){
                var childNodeName = childNodes[i].name;
                if(childNodeName) {
                    buildLookUpTable(childNodes[i]);
                }
            }
        }
    }
}

/**
 *  Returns array of nodes which match with the tag name.
 */
export function getElementsByTagName(nodeName) {
    if(varUtility.isEmpty(nodeName))
        return [];
    var selectedElements = xmlDomLookUpTable[nodeName.toLowerCase()];
    if(!selectedElements){
        selectedElements = [];
    }
    return selectedElements;
}

/**
 *  Search in subtree with provided node name
 */
export function getChildElementsByTagName(node, tagName) {
    if(!varUtility.isObject(node) )
        return [];
    var children = node.children;
    var liveNodes = [];
    if(children){
        for( var i=0; i < children.length; i++ ){
            var childName = children[i].name;
            if( !varUtility.isEmpty(childName) && tagName == childName){
                liveNodes.push(children[i]);
            }
            var liveChildNodes = getChildElementsByTagName(children[i], tagName);
            if(liveChildNodes && liveChildNodes.length > 0){
            	liveNodes.concat(liveChildNodes);
            }
        }
    }
    return liveNodes;
}
