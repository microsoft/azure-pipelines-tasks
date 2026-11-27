This folder holds data used by the unit tests of the download code.

* reference-*.json, next-reference-*.json, next-reference-super-root.bin
  Reference manifests and node data captured from Microsoft's public ArtifactTool SDK and published as test
  fixtures of cataggar/az-artifacts (MIT License, Copyright (c) Microsoft Corporation). The data is synthetic.
* lz77-real-samples.json
  Three compressed chunks (and the identifiers of their uncompressed content) read from the dedup store of the
  public dotnet/runtime pipeline artifacts in https://dev.azure.com/dnceng-public (build logs, public data).
* dotnet-parse-vectors.json, Generate-DotNetParseVectors.ps1
  What .NET int.TryParse, Guid.TryParse and bool.TryParse return for a set of inputs, as produced by the script on
  .NET 10. The agent plugins used these APIs, so the tests compare the TypeScript parsers with them.
* patterns-windows.json
  The items that the agent plugin restored for a set of patterns on Windows: the expected results of the pattern tests.
