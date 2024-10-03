Version 2 -> Version 3

# ICodeCoverageEnabler

## enableCodeCoverage

**from**

> `enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean>;`

**to**

> `enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<string>;`

# CodeCoverageEnabler

## enableCodeCoverage

**from**

> `abstract enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<boolean>;`

**to**

> `abstract enableCodeCoverage(ccProps: { [name: string]: string }): Q.Promise<string>;`

# CoberturaAntCodeCoverageEnabler

Tasks using v2 can be safely upgraded to v3. Note that the `enableCodeCoverage` method now returns a string instead of a boolean. Tasks don't currently use this property.

# CoberturaGradleCodeCoverageEnabler

Tasks using v2 can be safely upgraded to v3. Note that the `enableCodeCoverage` method now returns a string instead of a boolean. Tasks don't currently use this property.

# CoberturaMavenCodeCoverageEnabler

Tasks using v2 can be safely upgraded to v3. Note that the `enableCodeCoverage` method now returns a string instead of a boolean. Tasks don't currently use this property.

# JacocoAntCodeCoverageEnabler

Tasks using v2 can be safely upgraded to v3. Note that the `enableCodeCoverage` method now returns a string instead of a boolean. Tasks don't currently use this property.

# JacocoGradleCodeCoverageEnabler

Tasks using v2 can be safely upgraded to v3. Note that the `enableCodeCoverage` method now returns a string instead of a boolean. Tasks don't currently use this property.

# JacocoMavenCodeCoverageEnabler

This class has breaking changes.
