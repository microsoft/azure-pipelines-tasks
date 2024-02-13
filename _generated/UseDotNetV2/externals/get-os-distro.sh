#!/usr/bin/env bash
# Copyright (c) .NET Foundation and contributors. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
#

# Stop script on NZEC
set -e
# Stop script if unbound variable found (use ${var:-} if intentional)
set -u
# By default cmd1 | cmd2 returns exit code of cmd2 regardless of cmd1 success
# This is causing it to fail
set -o pipefail

# Use in the the functions: eval $invocation
invocation='say_verbose "Calling: ${yellow:-}${FUNCNAME[0]} ${green:-}$*${normal:-}"'

# standard output may be used as a return value in the functions
# we need a way to write text on the screen in the functions so that
# it won't interfere with the return value.
# Exposing stream 3 as a pipe to standard output of the script itself
exec 3>&1

say_err() {
    printf "%b\n" "get-os-distro: Error: $1" >&2
}

# This platform list is finite - if the SDK/Runtime has supported Linux distribution-specific assets,
#   then and only then should the Linux distribution appear in this list.
# Adding a Linux distribution to this list does not imply distribution-specific support.
get_legacy_os_name_from_platform() {

    platform="$1"
    case "$platform" in
        "centos.7")
            echo "centos"
            return 0
            ;;
        "debian.8")
            echo "debian"
            return 0
            ;;
        "fedora.23")
            echo "fedora.23"
            return 0
            ;;
        "fedora.27")
            echo "fedora.27"
            return 0
            ;;
        "fedora.24")
            echo "fedora.24"
            return 0
            ;;
        "opensuse.13.2")
            echo "opensuse.13.2"
            return 0
            ;;
        "opensuse.42.1")
            echo "opensuse.42.1"
            return 0
            ;;
        "opensuse.42.3")
            echo "opensuse.42.3"
            return 0
            ;;
        "rhel.7"*)
            echo "rhel"
            return 0
            ;;
        "ubuntu.14.04")
            echo "ubuntu"
            return 0
            ;;
        "ubuntu.16.04")
            echo "ubuntu.16.04"
            return 0
            ;;
        "ubuntu.16.10")
            echo "ubuntu.16.10"
            return 0
            ;;
        "ubuntu.18.04")
            echo "ubuntu.18.04"
            return 0
            ;;
        "alpine.3.4.3")
            echo "alpine"
            return 0
            ;;
    esac
    return 1
}

get_linux_platform_name() {

    if [ -e /etc/os-release ]; then
        . /etc/os-release
        echo "$ID.$VERSION_ID"
        return 0
    elif [ -e /etc/redhat-release ]; then
        local redhatRelease=$(</etc/redhat-release)
        if [[ $redhatRelease == "CentOS release 6."* || $redhatRelease == "Red Hat Enterprise Linux Server release 6."* ]]; then
            echo "rhel.6"
            return 0
        fi
    fi

    say_err "Linux specific platform name and version could not be detected: UName = $uname"
    return 1
}

get_current_os_name() {

    local uname=$(uname)
    if [ "$uname" = "Darwin" ]; then
        echo "osx"
        return 0
    elif [ "$uname" = "Linux" ]; then
        local linux_platform_name
        linux_platform_name="$(get_linux_platform_name)" || { echo "linux" && return 0 ; }

        if [[ $linux_platform_name == "rhel.6" ]]; then
            echo "$linux_platform_name"
            return 0
        elif [[ $linux_platform_name == alpine* ]]; then
            echo "linux-musl"
            return 0
        else
            echo "linux"
            return 0
        fi
    fi

    say_err "OS name could not be detected: UName = $uname"
    return 1
}

get_legacy_os_name() {

    local uname=$(uname)
    if [ "$uname" = "Darwin" ]; then
        echo "osx"
        return 0
    else
        if [ -e /etc/os-release ]; then
            . /etc/os-release
            os=$(get_legacy_os_name_from_platform "$ID.$VERSION_ID" || echo "")
            if [ -n "$os" ]; then
                echo "$os"
                return 0
            fi
        fi
    fi

    say_err "Distribution specific OS name and version could not be detected: UName = $uname"
    return 1
}

get_machine_architecture() {

    if command -v uname > /dev/null; then
        local osn=$(get_current_os_name || echo "")
        CPUName=$(uname -m)
        case $CPUName in
        armv7l)
            echo "arm"
            return 0
            ;;
        aarch64)
            echo "arm64"
            return 0
            ;;
        arm64)
            echo "arm64"
            return 0
            ;;
        x86_64)
            if [ "$osn" = "osx" ]; then
                if [ "$(sysctl -in sysctl.proc_translated)" = "1" ]; then
                    echo "arm64"
                else
                    echo "x64"
                fi
                return 0
            fi
            ;;
        esac
    fi

    # Always default to 'x64'
    echo "x64"
    return 0
}

osName=$(get_current_os_name || echo "")
legacyOsName=$(get_legacy_os_name || echo "")
arch=$(get_machine_architecture || echo "")

primaryName="$osName-$arch"
legacyName="$legacyOsName-$arch"

echo "Primary:$primaryName"
echo "Legacy:$legacyName"

if [ -z "$osName" ] && [ -z "$legacyOsName" ];then
    exit 1
fi
