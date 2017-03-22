"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import * as constants from "./constants";
import * as definitions from "./definitions"
import * as utils from "./utilities"

export default class TemplateFileProviderBase {

    public moveTemplateFile(initialTemplateFileLocation: string, dest: string): void {
        console.log(tl.loc("OriginalTemplateLocation", initialTemplateFileLocation));
        console.log(tl.loc("CopyingTemplate", initialTemplateFileLocation, dest));
        utils.copyFile(initialTemplateFileLocation, dest);
        console.log(tl.loc("TempTemplateLocation", dest));      
        
        // construct new full path for template file
        var templateFileName = path.basename(initialTemplateFileLocation);
        var tempFileLocation = path.join(dest, templateFileName);
        this._templateFileLocation = tempFileLocation;
        tl.debug("template location: " + tempFileLocation);
    }

    public updateTemplateFile(content: string): void {
        if(utils.IsNullOrEmpty(content)) {
            return;
        }

        var templateFileName = path.basename(this._templateFileLocation, '.json');
        var templateDir = path.dirname(this._templateFileLocation);
        var updatedTemplateFileName = util.format("%s-fixed.json", templateFileName);
        var tempFileLocation = path.join(templateDir, updatedTemplateFileName);

        utils.writeFile(tempFileLocation, content);

        this._templateFileLocation = tempFileLocation;
        tl.debug("fixed template location: " + tempFileLocation);
    }

    public cleanup(): void {
        if(!this._templateFileLocation) {
            return;
        }
        
        var templateFileDirectory = path.dirname(this._templateFileLocation);    
        try{
            utils.deleteDirectory(templateFileDirectory);
        }
        catch (err) {
            tl.warning(tl.loc("CouldNotDeleteTemporaryTemplateDirectory", templateFileDirectory));
        }
    }

    protected _templateFileLocation: string;
}