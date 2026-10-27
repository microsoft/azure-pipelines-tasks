This folder holds data used by the unit tests of azure-pipelines-tasks-pipeline-artifacts-common.

* sdk-chunk-vectors.json, reference-*.json, next-reference-*.json, next-reference-super-root.bin
  Chunker vectors and reference manifests captured from Microsoft's public ArtifactTool SDK and published as test
  fixtures of cataggar/az-artifacts (MIT License, Copyright (c) Microsoft Corporation). The data is synthetic.
* lz77-real-samples.json
  Three compressed chunks (and the identifiers of their uncompressed content) read from the dedup store of the
  public dotnet/runtime pipeline artifacts in https://dev.azure.com/dnceng-public (build logs, public data).
* dotnet-parse-vectors.json, Generate-DotNetParseVectors.ps1
  What .NET int.TryParse, Guid.TryParse and Json.NET (deserializing an IDictionary<string, string>) return for a set of
  inputs, as produced by the script on .NET 10 with Newtonsoft.Json 13.0.4. The agent plugins used these APIs, so the
  tests compare the TypeScript parsers with them.
