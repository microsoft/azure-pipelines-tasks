import { npmcommon } from "./npmL0";
import { nugetcommon } from "./nugetL0";
import * as pkgLocationUtils from "../locationUtilities";
import * as assert from "assert";

describe("packaging-common Task Suite", function() {
    describe("nuget common", nugetcommon);
    describe("npm common", npmcommon);
});

describe("packaging-common locationUtilities Suite", function() {
    it("retryOnExceptionHelper, succeeds after one retry", async() => {
        let numExecutions = 0;
        let succeedAfterThrowingOnce = () => {
            if(numExecutions == 1) {
                return new Promise<boolean>((resolve, _) => resolve(true));
            }
            else {
                numExecutions++;
                throw new Error();
            }
        }

        let result = await pkgLocationUtils.retryOnExceptionHelper(() => succeedAfterThrowingOnce(), 3, 10)
        assert(result == true, "result should have been true");
        assert(numExecutions == 1, "succeedAfterThrowingOnce should have run twice.");
    });

    it("retryOnExceptionHelper, throws after one retry", async() => {
        let numExecutions = 0;
        let succeedAfterThrowingOnce = () => {
            if(numExecutions == 1) {
                return new Promise<boolean>((resolve, _) => resolve(true));
            }
            else {
                numExecutions++;
                throw new Error("Error thrown");
            }
        }

        pkgLocationUtils.retryOnExceptionHelper(() => succeedAfterThrowingOnce(), 1, 10)
            .then(() => {
                assert.fail("retryOnExceptionHelper should have failed after no retries, but succeeded");
            })
            .catch(() => {
                assert(numExecutions == 1, "retryOnExceptionHelper should have failed after no retries.");
            });        
    });

    it("retryOnNullOrExceptionHelper, null response, succeeds after one retry", async() => {
        let numExecutions = 0;
        let succeedAfterReturningNullOnce = () => {
            if(numExecutions == 1) {
                return new Promise<boolean>((resolve, _) => resolve(true));
            }
            else {
                numExecutions++;
                return null;
            }
        }

        let result = await pkgLocationUtils.retryOnNullOrExceptionHelper(() => succeedAfterReturningNullOnce(), 3, 10)
        assert(result == true, "result should have been true");
        assert(numExecutions == 1, "succeedAfterReturningNullOnce should have run twice.");
    });

    it("retryOnNullOrExceptionHelper, null response, throws after one retry", async() => {
        let numExecutions = 0;
        let succeedAfterReturningNullOnce = () => {
            if(numExecutions == 1) {
                return new Promise<boolean>((resolve, _) => resolve(true));
            }
            else {
                numExecutions++;
                return null;
            }
        }

        pkgLocationUtils.retryOnExceptionHelper(() => succeedAfterReturningNullOnce(), 1, 10)
            .then(() => {
                assert.fail("retryOnNullOrExceptionHelper should have failed after no retries, but succeeded");
            })
            .catch(() => {
                assert(numExecutions == 1, "retryOnNullOrExceptionHelper should have failed after no retries.");
            });    
    });


    it("retryOnNullOrExceptionHelper, undefined response, succeeds after one retry", async() => {
        let numExecutions = 0;
        let succeedAfterReturningUndefinedOnce = () => {
            if(numExecutions == 1) {
                return new Promise<boolean>((resolve, _) => resolve(true));
            }
            else {
                numExecutions++;
                return undefined;
            }
        }

        let result = await pkgLocationUtils.retryOnNullOrExceptionHelper(() => succeedAfterReturningUndefinedOnce(), 3, 10)
        assert(result == true, "result should have been true");
        assert(numExecutions == 1, "succeedAfterReturningUndefinedOnce should have run twice.");
    });

    it("retryOnNullOrExceptionHelper, undefined response, throws after one retry", async() => {
        let numExecutions = 0;
        let succeedAfterReturningUndefinedOnce = () => {
            if(numExecutions == 1) {
                return new Promise<boolean>((resolve, _) => resolve(true));
            }
            else {
                numExecutions++;
                return undefined;
            }
        }

        pkgLocationUtils.retryOnExceptionHelper(() => succeedAfterReturningUndefinedOnce(), 1, 10)
            .then(() => {
                assert.fail("retryOnNullOrExceptionHelper should have failed after no retries, but succeeded");
            })
            .catch(() => {
                assert(numExecutions == 1, "retryOnNullOrExceptionHelper should have failed after no retries.");
            });    
    });
});
