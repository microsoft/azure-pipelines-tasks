/*
* ---------------------------------------------------------
* Copyright(C) Microsoft Corporation. All rights reserved.
* ---------------------------------------------------------
* 
* ---------------------------------------------------------
* Generated file, DO NOT EDIT
* ---------------------------------------------------------
*/

"use strict";

/**
 * Reference for an async operation.
 */
export interface OperationReference {
    /**
     * The identifier for this operation.
     */
    id: string;
    /**
     * The current status of the operation.
     */
    status: OperationStatus;
    /**
     * Url to get the full object.
     */
    url: string;
}

export enum OperationStatus {
    /**
     * The operation object does not have the status set.
     */
    NotSet = 0,
    /**
     * The operation has been queued.
     */
    Queued = 1,
    /**
     * The operation is in progress.
     */
    InProgress = 2,
    /**
     * The operation was cancelled by the user.
     */
    Cancelled = 3,
    /**
     * The operation completed successfully.
     */
    Succeeded = 4,
    /**
     * The operation completed with a failure.
     */
    Failed = 5,
}

export var TypeInfo = {
    OperationReference: {
        fields: <any>null
    },
    OperationStatus: {
        enumValues: {
            "notSet": 0,
            "queued": 1,
            "inProgress": 2,
            "cancelled": 3,
            "succeeded": 4,
            "failed": 5,
        }
    },
};

TypeInfo.OperationReference.fields = {
    status: {
        enumType: TypeInfo.OperationStatus
    },
};
