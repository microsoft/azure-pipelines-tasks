// TODO: This file should be moved to the common package as a spotbugs tool
import * as tl from 'azure-pipelines-task-lib/task';

/**
 * Add the property to the JSON object.
 *
 * Note: it mutates the original json object
 *
 * @param obj - Original JSON object.
 * @param propName - Name of the property to add.
 * @param value - Property value.
 */
export function addPropToJson(obj: any, propName: string, value: any): void {
    if (!obj) {
        obj = {};
    }

    if (obj instanceof Array) {
        const propNode = obj.find(o => o[propName]);
        if (propNode) {
            obj = propNode;
        }
    }

    const containsId: (o) => boolean = function (o) {
        if (value && value.id) {
            if (o.id instanceof Array) {
                return o.id.find((v) => {
                    return v === value.id;
                });
            } else {
                return value.id === o.id;
            }
        }
        return false;
    };

    if (propName in obj) {
        if (obj[propName] instanceof Array) {
            const existing = obj[propName].find(containsId);
            if (existing) {
                tl.warning(tl.loc('EntryAlreadyExists'));
                tl.debug('Entry: ' + value.id);
            } else {
                obj[propName].push(value);
            }
        } else if (typeof obj[propName] !== 'object') {
            obj[propName] = [obj[propName], value];
        } else {
            const prop = {};
            prop[propName] = value;
            obj[propName] = [obj[propName], value];
        }
    } else if (obj instanceof Array) {
        const existing = obj.find(containsId);
        if (existing) {
            tl.warning(tl.loc('EntryAlreadyExists'));
            tl.debug('Entry: ' + value.id);
        } else {
            const prop = {};
            prop[propName] = value;
            obj.push(prop);
        }
    } else {
        obj[propName] = value;
    }
}
