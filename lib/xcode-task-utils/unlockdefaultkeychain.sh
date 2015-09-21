#!/bin/sh
/usr/bin/security unlock-keychain -p "$1" "$(security default-keychain | grep -oE '"(.+?)"' | grep -oE '[^"]*[\n]')"
if [ $? -ne 0 ]
then
	echo "Failed to unlock default keychain."
	exit 1
fi
