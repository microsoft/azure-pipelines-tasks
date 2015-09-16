#!/bin/sh
/usr/bin/security create-keychain -p "$2" "$1" || { exit 1; }
/usr/bin/security set-keychain-settings -lut 7200 "$1" || { exit 1; }
/usr/bin/security unlock-keychain -p "$2" "$1" || { exit 1; }
/usr/bin/security import "$3" -P "$4" -A -t cert -f pkcs12 -k "$1" || { exit 1; }
/usr/bin/security list-keychain -d user -s "$1" $(/usr/bin/security list-keychains -d user | grep -oE '[^"]*[\n]' || { exit 1; }) || { exit 1; }