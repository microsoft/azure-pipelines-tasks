#!/bin/sh
#
#  Copyright (c) Microsoft. All rights reserved.  
#  Licensed under the MIT license. See LICENSE file in the project root for full license information.
#
/usr/bin/security unlock-keychain -p "$1" "$(security default-keychain | grep -oE '"(.+?)"' | grep -oE '[^"]*[\n]')"
if [ $? -ne 0 ]
then
	echo "Failed to unlock default keychain."
	exit 1
fi

#