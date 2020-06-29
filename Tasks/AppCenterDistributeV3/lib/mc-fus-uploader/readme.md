This directory contains a NodeJS port of the library used to upload releases to App Center.

The library leverages App Center File Upload Service and allows uploading many chunks (slices of a release binary) in parallel. It takes the binary file, slices it in 4mb chunks, and uploads them simultaneously.

The main benefits of that approach:

* Uploading speed can be ten times faster for high latency connections.
* Smart retry mechanism: the retries are made on a per-chunk basis.
