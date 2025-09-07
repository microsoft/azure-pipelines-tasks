# Azure Pipelines Tasks Using azure-pipelines-tool-lib

This document lists all Azure Pipeline tasks that use the `azure-pipelines-tool-lib` dependency along with their respective owners and version information.

**Generated on:** September 7, 2025  
**Total Tasks:** 33

## Summary by Owner Teams

### @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani (15 tasks)
- CondaEnvironmentV0
- DotNetCoreInstallerV0  
- DotNetCoreInstallerV1
- JavaToolInstallerV0
- JavaToolInstallerV1
- MavenV2
- MavenV3
- NodeTaskRunnerInstallerV0
- NodeToolV0
- NotationV0
- UseDotNetV2
- UseNodeV1
- UsePythonVersionV0
- UseRubyVersionV0
- XcodeV5

### @microsoft/release-management-task-team @manolerazvan (13 tasks)
- AzureFunctionOnKubernetesV1
- ContainerBuildV0
- DockerInstallerV0
- DuffleInstallerV0
- FuncToolsInstallerV0
- GoToolV0
- HelmInstallerV0
- HelmInstallerV1
- KubectlInstallerV0
- KubeloginInstallerV0
- KubernetesV1
- KubernetesManifestV0
- KubernetesManifestV1

### @manos @microsoft/adoautotest (3 tasks)
- AzureTestPlanV0
- ContainerStructureTestV0
- VsTestPlatformToolInstallerV1

### Other Owners (2 tasks)
- OpenPolicyAgentInstallerV0: (No explicit owner listed)
- PipAuthenticateV0: @microsoft/azure-artifacts-packages

---

## Complete Task List with Details

| Task Name | Tool-lib Version | Owners | Category | Description |
|-----------|------------------|---------|----------|-------------|
| **AzureFunctionOnKubernetesV1** | ^2.0.7 | @microsoft/release-management-task-team @manolerazvan | Deploy | Azure Function on Kubernetes |
| **AzureTestPlanV0** | ^2.0.0-preview | @manos @microsoft/adoautotest | Test | Azure Pipelines Run Manual and Automated Test execution Task |
| **CondaEnvironmentV0** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Create and activate a Conda environment |
| **ContainerBuildV0** | 2.0.7 | @microsoft/release-management-task-team @manolerazvan | Build | Container Build Task |
| **ContainerStructureTestV0** | ^2.0.7 | @manos @microsoft/adoautotest | Test | Azure Pipelines Container Structure Test execution Task |
| **DockerInstallerV0** | ^2.0.0-preview | @microsoft/release-management-task-team @manolerazvan | Tool | Docker Installer |
| **DotNetCoreInstallerV0** | ^2.0.0-preview | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani @DergachevE | Tool | .Net Core Installer |
| **DotNetCoreInstallerV1** | ^2.0.0-preview | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani @DergachevE | Tool | .Net Core Installer |
| **DuffleInstallerV0** | ^1.3.2 | @microsoft/release-management-task-team @manolerazvan | Tool | Duffle Installer |
| **FuncToolsInstallerV0** | 2.0.0-preview | @microsoft/release-management-task-team @manolerazvan | Tool | Function Tools Installer |
| **GoToolV0** | ^2.0.0-preview | @microsoft/release-management-task-team @manolerazvan | Tool | GoLang Tool Installer |
| **HelmInstallerV0** | 2.0.0-preview | @microsoft/release-management-task-team @manolerazvan | Tool | Helm Installer |
| **HelmInstallerV1** | 2.0.0-preview | @microsoft/release-management-task-team @manolerazvan | Tool | Helm Installer |
| **JavaToolInstallerV0** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Java Tool Installer |
| **JavaToolInstallerV1** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Java Tool Installer |
| **KubectlInstallerV0** | 2.0.0-preview | @microsoft/release-management-task-team @manolerazvan | Tool | Kubectl Installer |
| **KubeloginInstallerV0** | ^2.0.4 | @YevheniiKholodkov @microsoft/release-management-task-team @manolerazvan | Tool | Kubelogin Installer |
| **KubernetesManifestV0** | ^2.0.4 | @microsoft/release-management-task-team @manolerazvan | Deploy | Deploy to Kubernetes |
| **KubernetesManifestV1** | ^2.0.4 | @microsoft/release-management-task-team @manolerazvan | Deploy | Deploy to Kubernetes |
| **KubernetesV1** | ^2.0.0-preview | @microsoft/release-management-task-team @manolerazvan | Deploy | Deploy to Kubernetes |
| **MavenV2** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Build | Build with Apache Maven |
| **MavenV3** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Build | Build with Apache Maven |
| **NodeTaskRunnerInstallerV0** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Node Task Runner Installer |
| **NodeToolV0** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Node Tool Installer |
| **NotationV0** | 2.0.7 | @Azure/azure-container-registry @JeyJeyGao @Two-Hearts @shizhMSFT @tarunramsinghani | Tool | Setting up Notation CLI, sign and verify with Notation |
| **OpenPolicyAgentInstallerV0** | ^2.0.0-preview | *(No explicit owner listed)* | Tool | Open Policy Agent Installer |
| **PipAuthenticateV0** | ^2.0.0-preview | @microsoft/azure-artifacts-packages | Tool | Authenticate pip client |
| **UseDotNetV2** | ^2.0.8 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani @DergachevE | Tool | Use .Net Core |
| **UseNodeV1** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Use Node.js ecosystem |
| **UsePythonVersionV0** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Use Python Version |
| **UseRubyVersionV0** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Tool | Use Ruby Version |
| **VsTestPlatformToolInstallerV1** | ^2.0.0-preview | @manos @microsoft/adoautotest | Tool | Visual Studio Test Platform Installer |
| **XcodeV5** | ^2.0.7 | @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani | Build | Xcode build and test |

---

## Version Distribution

| Version Range | Task Count | Tasks |
|---------------|------------|--------|
| **^2.0.7** | 12 | CondaEnvironmentV0, JavaToolInstallerV0, JavaToolInstallerV1, MavenV2, MavenV3, NodeTaskRunnerInstallerV0, NodeToolV0, UseNodeV1, UsePythonVersionV0, UseRubyVersionV0, XcodeV5, AzureFunctionOnKubernetesV1, ContainerStructureTestV0 |
| **^2.0.0-preview** | 10 | AzureTestPlanV0, DockerInstallerV0, DotNetCoreInstallerV0, DotNetCoreInstallerV1, GoToolV0, KubernetesV1, OpenPolicyAgentInstallerV0, PipAuthenticateV0, VsTestPlatformToolInstallerV1 |
| **2.0.0-preview** | 4 | FuncToolsInstallerV0, HelmInstallerV0, HelmInstallerV1, KubectlInstallerV0 |
| **^2.0.4** | 3 | KubeloginInstallerV0, KubernetesManifestV0, KubernetesManifestV1 |
| **^2.0.8** | 1 | UseDotNetV2 |
| **2.0.7** | 2 | ContainerBuildV0, NotationV0 |
| **^1.3.2** | 1 | DuffleInstallerV0 |

---

## Notes

- **Total Dependencies:** 33 tasks use `azure-pipelines-tool-lib`
- **Most Common Version:** `^2.0.7` (used by 12 tasks)
- **Primary Owner Teams:** 
  - `@microsoft/azure-pipelines-tasks-and-agent` with `@tarunramsinghani` (15 tasks)
  - `@microsoft/release-management-task-team` with `@manolerazvan` (13 tasks)
- **Task Categories:** Primarily tool installers, build environment setup, and deployment tasks
- **OpenPolicyAgentInstallerV0** does not have explicit owners listed in CODEOWNERS

## Update Status (First Ownership Group)

**Updated Tasks from @microsoft/azure-pipelines-tasks-and-agent @tarunramsinghani group:**

✅ **Successfully Completed (14 tasks):**
- CondaEnvironmentV0 - Updated to ^2.0.10, npm install ✅, build ✅
- DotNetCoreInstallerV0 - Updated to ^2.0.10, npm install ✅, build ✅  
- DotNetCoreInstallerV1 - Updated to ^2.0.10, npm install ✅, build ✅
- JavaToolInstallerV0 - Updated to ^2.0.10, npm install ✅, build ✅
- JavaToolInstallerV1 - Updated to ^2.0.10, npm install ✅, build ✅
- MavenV2 - Updated to ^2.0.10, npm install ✅, build ✅
- MavenV3 - Updated to ^2.0.10, npm install ✅, build ✅
- NodeTaskRunnerInstallerV0 - Updated to ^2.0.10, npm install ✅, build ✅
- NodeToolV0 - Updated to ^2.0.10, npm install ✅, build ✅
- UseDotNetV2 - Updated to ^2.0.10, npm install ✅, build ✅
- UseNodeV1 - Updated to ^2.0.10, npm install ✅, build ✅
- UsePythonVersionV0 - Updated to ^2.0.10, npm install ✅, build ✅
- UseRubyVersionV0 - Updated to ^2.0.10, npm install ✅, build ✅
- XcodeV5 - Updated to ^2.0.10, npm install ✅, build ✅

⚠️ **Partial Completion (1 task):**
- NotationV0 - Updated to ^2.0.10, npm install ❌ (Node.js v22 compatibility issue with deasync package), build ❌

**Additional Task from @manos @microsoft/adoautotest group:**
✅ VsTestPlatformToolInstallerV1 - Updated to ^2.0.10, npm install ✅, build ✅

**Total Progress:** 15 out of 16 tasks successfully completed (93.75%)

---

*This document is automatically generated based on package.json dependencies and CODEOWNERS file analysis.*
