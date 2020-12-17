export declare class NpmDomUtility {
    private xmlDomLookUpTable;
    private xmlDom;
    constructor(xmlContent: any);
    getXmlDom(): any;
    getContentWithHeader(xmlDom: any): any;
    /**
     * Define method to create a lookup for DOM
     */
    private buildLookUpTable;
    /**
     *  Returns array of nodes which match with the tag name.
     */
    getElementsByTagName(nodeName: any): any;
    /**
     *  Search in subtree with provided node name
     */
    getChildElementsByTagName(node: any, tagName: any): any[];
}
