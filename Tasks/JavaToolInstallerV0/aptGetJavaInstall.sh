echo 'Adding repository open-jdk-r';
REPO='ppa:openjdk-r/ppa'
sudo apt-add-repository -y $REPO && sudo apt-get update && sudo apt-get install -y --no-install-recommends openjdk-$1-jdk && sudo rm -rf /var/lib/apt/lists/*
