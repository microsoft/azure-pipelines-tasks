import { RestError } from "@azure/core-rest-pipeline";

/**
 * Custom error type used during input validation
 */
export class ArgumentError extends Error {
}

/**
 * Custom error type used for expected RestError ie: Conflict and Forbidden. 
 */
export class AppConfigurationError extends Error {
    public message: string;

    constructor(message: string) {
        super();

        this.message = message;
    }
}

/**
 * Custom error type used when null arguments are passed
 */
export class ArgumentNullError extends Error {
}

/**
 * Custom error type used during JSON data parsing
 */
export class ParseError extends Error {
    public message: string;
  
    constructor(message: string) {
        super();
  
        this.message = message;
    }
}

/**
 * Obtains an error message to output to the log
 * 
 * @param error Error object
 * @param description Optional description to include in the error message
 */

export function getErrorMessage(error: any, description?: string): string {

    const parts: string[] = [description];

    // Include the error message from our custom Error types
    if (error instanceof RestError) {

        // Include status code if present 
        const statusCode: string | number = error.statusCode || error.code;

        if (statusCode) {

            parts.push(`Status code: ${statusCode}`);
        }
    }
    else if (error instanceof Error) {

        parts.push(error.message);
    }

    // Remove null/undefined/empty values
    const filteredParts: string[] = parts.filter((e: string) => e);

    return filteredParts.length === 0 ?
        "An unknown error occurred." :
        filteredParts.join(" ");
}