pe-parser
=========

Required reading:
-----------------

* [https://msdn.microsoft.com/en-us/library/windows/desktop/ms680547(v=vs.85).aspx](PE format documentation)
* [https://msdn.microsoft.com/en-us/library/windows/desktop/ms647001(v=vs.85).aspx](Version resource documentation)

If you're reading the code for the first time, I recommend skimming the docs above first, then start with getFileVersionInfoAsync in index.ts. The various .ts files
mostly correspond to the major structures of the file:
* PEImageFile => signatures and COFF header
* SectionTable => section table
* ResourceSection => resource table
* VersionResource => VS\_VERSION\_INFO resource 