# This script reads a checksums.txt file and generates a JSON file containing 
# the checksums and URLs for each file. The generated JSON file is then merged 
# with an existing JSON file containing previous checksums. If the version 
# already exists in the existing JSON file, an exception is raised.
#
# Usage: python generate_checksum.py <checksums.txt> <old_checksums.json>
#
# checksums.txt format:
# 2ef0560c3c88908a22d1f302e5b0119160e72380e25fb58c2d7b153e9397a04c  notation_1.0.0-rc.1_linux_arm64.tar.gz
# 3b5239d68810fec349807aa9eb90fcb9cd972cdb540ecfd4fcf3631d7ad4be06  notation_1.0.0-rc.1_darwin_amd64.tar.gz
# 7607c8de3b6c1435b2dc4c012e9c0486849ce7b4b5e0fbbee2dd9ed7aab084a7  notation_1.0.0-rc.1_linux_amd64.tar.gz
# 7d091cbd62886d1b47b60519a5b56314e794caf18751b1cccab2f54387a0d5c4  notation_1.0.0-rc.1_windows_amd64.zip
# eaa7b0c7c8d18e504766ce8d3ac5e46da2e97f4fdcead8be997e0ae74b146b00  notation_1.0.0-rc.1_darwin_arm64.tar.gz
#
# Note: This script may be integrated to pipeline in the future.
#
import os
import sys
import json

def build_url(name, version, filename):
    return {
        "notation": lambda : f'https://github.com/notaryproject/notation/releases/download/v{version}/{filename}',
        "notation-azure-kv": lambda :f'https://github.com/Azure/notation-azure-kv/releases/download/v{version}/{filename}'
    }[name]()


def process_checksum(filepath):
    verionInfo = {}
    with open(filepath, 'r') as f:
        for line in f.readlines():
            line = line.rstrip('\n')
            parts = line.split(' ')
            checksum = parts[0]
            filename = parts[2]
            name_parts = filename.split('_')
            name = name_parts[0]
            version = name_parts[1]
            osName = name_parts[2]
            arch = name_parts[3].split('.')[0]

            # generate checksum
            verionInfo.setdefault('version', version)
            verionInfo.setdefault(osName, {})
            verionInfo[osName].setdefault(arch, {})
            verionInfo[osName][arch] = {
                "url": build_url(name, version, filename),
                "checksum": checksum
            }

    return verionInfo

def update_checksums(filepath, checksums):
    # read old checksums
    versionList = []
    if os.path.exists(filepath):
        f = open(filepath, 'r')
        versionList = json.load(f)
        f.close()

    # check if version exists
    for versionInfo in versionList:
        if versionInfo['version'] == checksums['version']:
            raise Exception(f'Version {checksums["version"]} already exists in {filepath}')

    # update checksums
    with open(filepath, 'w') as f:
        json.dump([checksums] + versionList, f, indent=4, sort_keys=True)

def main():
    if len(sys.argv) < 3:
        print('Usage: python generate_checksum.py <checksums.txt> <old_checksums.json>')
        sys.exit(1)
    
    filepath = sys.argv[1]
    old_checksums = sys.argv[2]

    checksums = process_checksum(filepath)
    update_checksums(old_checksums, checksums)

if __name__ == '__main__':
    main()
