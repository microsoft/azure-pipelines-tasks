var ltx = require("ltx");
var utility = require("./utility.js");

var xmlDomLookUpTable = {};

export function initializeDOM(xmlContent) {
	var xmlDom = ltx.parse(xmlContent);
	xmlDomLookUpTable = {};
	buildLookUpTable(xmlDom);
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
	if(nodeName == null || nodeName == "")
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
export function getChildElementsByTagName(node, tagName){
	if(utility.isEmpty(node) || !utility.isObject(node) )
		return [];
	var children = node.children;
	var liveNodes = [];
	if(children){
		for( var i=0; i < children.length; i++ ){
			var childName = children[i].name;
			if( !utility.isEmpty(childName) && tagName == childName){
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





