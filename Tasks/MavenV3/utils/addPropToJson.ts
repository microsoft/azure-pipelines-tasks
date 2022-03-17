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
    if (typeof obj === "undefined") {
        obj = {};
    }

    if (obj instanceof Array) {
        const propNode = obj.find(o => o[propName]);
        if (propNode) {
            obj = propNode;
        }
    }

    if (propName in obj) {
        if (obj[propName] instanceof Array) {
            obj[propName].push(value);
        } else if (typeof obj[propName] !== "object") {
            obj[propName] = [obj[propName], value];
        }
    } else if (obj instanceof Array) {
        const prop = {};
        prop[propName] = value;
        obj.push(prop);
    } else {
        obj[propName] = value;
    }
}
