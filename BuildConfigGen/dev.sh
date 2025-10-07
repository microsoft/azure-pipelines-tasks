#!/bin/bash

function detect_platform_and_runtime_id ()
{
    heading "Platform / RID detection"

    CURRENT_PLATFORM="windows"
    if [[ ($(uname) == "Linux") || ($(uname) == "Darwin") ]]; then
        CURRENT_PLATFORM=$(uname | awk '{print tolower($0)}')
    fi

    if [[ "$CURRENT_PLATFORM" == 'windows' ]]; then
        DETECTED_RUNTIME_ID='win-x64'
        if [[ "$PROCESSOR_ARCHITECTURE" == 'x86' ]]; then
            DETECTED_RUNTIME_ID='win-x86'
        fi
    elif [[ "$CURRENT_PLATFORM" == 'linux' ]]; then
        DETECTED_RUNTIME_ID="linux-x64"
        if command -v uname > /dev/null; then
            local CPU_NAME=$(uname -m)
            case $CPU_NAME in
                armv7l) DETECTED_RUNTIME_ID="linux-arm";;
                aarch64) DETECTED_RUNTIME_ID="linux-arm64";;
            esac
        fi

        if [ -e /etc/redhat-release ]; then
            local redhatRelease=$(</etc/redhat-release)
            if [[ $redhatRelease == "CentOS release 6."* || $redhatRelease == "Red Hat Enterprise Linux Server release 6."* ]]; then
                DETECTED_RUNTIME_ID='rhel.6-x64'
            fi
        fi

    elif [[ "$CURRENT_PLATFORM" == 'darwin' ]]; then
        DETECTED_RUNTIME_ID='osx-x64'
    fi
}

SCRIPT_DIR=$1
pushd "$SCRIPT_DIR"
source "$SCRIPT_DIR/Misc/helpers.sh"
DOTNETSDK_INSTALLDIR=$2
DOTNETSDK_VERSION=$3

detect_platform_and_runtime_id
echo "Current platform: $CURRENT_PLATFORM"
echo "Current runtime ID: $DETECTED_RUNTIME_ID"

if [[ (! -d "${DOTNETSDK_INSTALLDIR}") || (! -e "${DOTNETSDK_INSTALLDIR}/.${DOTNETSDK_VERSION}") || (! -e "${DOTNETSDK_INSTALLDIR}/dotnet") ]]; then

    # Download dotnet SDK to ../_dotnetsdk directory
    heading "Install .NET SDK"

    # _dotnetsdk
    #           \1.0.x
    #                            \dotnet
    #                            \.1.0.x
    echo "Download dotnetsdk into ${DOTNETSDK_INSTALLDIR}"
    rm -Rf "${DOTNETSDK_DIR}"

    # run dotnet-install.ps1 on windows, dotnet-install.sh on linux
    if [[ ("$CURRENT_PLATFORM" == "windows") ]]; then
        echo "Convert ${DOTNETSDK_INSTALLDIR} to Windows style path"
        architecture=$( echo $DETECTED_RUNTIME_ID | cut -d "-" -f2)
        powershell -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command "& \"./Misc/dotnet-install.ps1\" -Version ${DOTNETSDK_VERSION} -InstallDir \"${DOTNETSDK_INSTALLDIR}\" -Architecture ${architecture}  -NoPath; exit \$LastExitCode;" || checkRC dotnet-install.ps1
    else
        bash ./Misc/dotnet-install.sh --version ${DOTNETSDK_VERSION} --install-dir "${DOTNETSDK_INSTALLDIR}" --no-path || checkRC dotnet-install.sh
    fi

    echo "${DOTNETSDK_VERSION}" > "${DOTNETSDK_INSTALLDIR}/.${DOTNETSDK_VERSION}"
fi

heading ".NET SDK to path"

echo "Adding .NET to PATH ${DOTNETSDK_INSTALLDIR}"
export PATH=${DOTNETSDK_INSTALLDIR}:$PATH
echo "Path = $PATH"
echo ".NET Version = $(dotnet --version)"
