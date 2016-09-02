#!/bin/sh
#
#  Copyright (c) Microsoft. All rights reserved.  
#  Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
if [ -f "$1" ]
then
	/usr/bin/security delete-keychain "$1"
fi

/usr/bin/security create-keychain -p "$2" "$1"
if [ $? -ne 0 ]
then
	echo "Failed to create keychain."
	exit 1
fi

/usr/bin/security set-keychain-settings -lut 7200 "$1"
if [ $? -ne 0 ]
then
	echo "Failed to update keychain setting."
	exit 1
fi

/usr/bin/security unlock-keychain -p "$2" "$1"
if [ $? -ne 0 ]
then
	echo "Failed to unlock keychain."
	exit 1
fi

/usr/bin/security import "$3" -P "$4" -A -t cert -f pkcs12 -k "$1"
if [ $? -ne 0 ]
then
	echo "Failed to import cert. Wrong password?"
	exit 1
fi

/usr/bin/security find-identity -v -p codesigning "$1"

/usr/bin/security list-keychain -d user -s "$1" $(/usr/bin/security list-keychains -d user | grep -oE '[^"]*[\n]')
if [ $? -ne 0 ]
then
	echo "Failed to add keychain to search path"
	exit 1
fi

/usr/bin/security list-keychain -d user

#