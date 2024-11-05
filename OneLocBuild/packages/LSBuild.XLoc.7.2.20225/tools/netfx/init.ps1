<#
.SYNOPSIS
    Run nuget initialization.

.DESCRIPTION
    This initialization script sets the embedinterop type of the managedlsom reference to false. This is required for LSbuild.
#>

param($installPath, $toolsPath, $package, $project)

$project.Object.References | Where-Object { $_.Name -eq "managedlsom" } |  ForEach-Object { $_.EmbedInteropTypes = $false }
