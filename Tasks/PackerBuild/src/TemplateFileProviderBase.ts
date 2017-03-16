"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import * as constants from "./constants";
import * as definitions from "./definitions"
import * as utils from "./utilities"

export default class TemplateFileProviderBase {

    public FinalizeTemplateLocation(initialTemplateFileLocation: string): void {
        console.log(tl.loc("OriginalTemplateLocation", initialTemplateFileLocation));

        // move file to a temp folder - this is a cautionary approach so that previous packer execution which still has handle on template does not cause any problem
        var tempLocationForTemplate = path.join(utils.getTempDirectory(), utils.getCurrentTime().toString())
        console.log(tl.loc("CopyingTemplate", initialTemplateFileLocation, tempLocationForTemplate));
        utils.copyFile(initialTemplateFileLocation, tempLocationForTemplate);
        console.log(tl.loc("TempTemplateLocation", tempLocationForTemplate));      
        
        // construct new full path for template file
        var templateFileName = path.basename(initialTemplateFileLocation);
        var tempFileLocation = path.join(tempLocationForTemplate, templateFileName);
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
            if(tl.exist(templateFileDirectory)) {
                tl.debug("Cleaning-up temporary directory " + this._templateFileLocation);
                tl.rmRF(templateFileDirectory, true);
            }
        }
        catch (err) {
            tl.warning(tl.loc("CouldNotDeleteTemporaryTemplateDirectory", templateFileDirectory));
        }
    }

    protected _templateFileLocation: string;
}