import { npmcommon } from "./npmL0";
import { nugetcommon } from "./nugetL0";

describe("packaging-common Task Suite", function() {
    describe("nuget common", nugetcommon);
    describe.skip("npm common", npmcommon);
});
