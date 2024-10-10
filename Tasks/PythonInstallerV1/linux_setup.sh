set -e

PYTHON_FULL_VERSION=$1
ARCH=$2
MAJOR_VERSION=$(echo $PYTHON_FULL_VERSION | cut -d '.' -f 1)
MINOR_VERSION=$(echo $PYTHON_FULL_VERSION | cut -d '.' -f 2)

PYTHON_MAJOR=python$MAJOR_VERSION
PYTHON_MAJOR_DOT_MINOR=python$MAJOR_VERSION.$MINOR_VERSION
PYTHON_MAJORMINOR=python$MAJOR_VERSION$MINOR_VERSION

if [ -z ${AGENT_TOOLSDIRECTORY+x} ]; then
    # No AGENT_TOOLSDIRECTORY on GitHub images
    TOOLCACHE_ROOT=$RUNNER_TOOL_CACHE
else
    TOOLCACHE_ROOT=$AGENT_TOOLSDIRECTORY
fi

PYTHON_TOOLCACHE_PATH=$TOOLCACHE_ROOT/Python
PYTHON_TOOLCACHE_VERSION_PATH=$PYTHON_TOOLCACHE_PATH/$PYTHON_FULL_VERSION
PYTHON_TOOLCACHE_VERSION_ARCH_PATH=$PYTHON_TOOLCACHE_VERSION_PATH/$ARCH

echo "Check if Python hostedtoolcache folder exist..."
if [ ! -d $PYTHON_TOOLCACHE_PATH ]; then
    echo "Creating Python hostedtoolcache folder..."
    mkdir -p $PYTHON_TOOLCACHE_PATH
elif [ -d $PYTHON_TOOLCACHE_VERSION_PATH ]; then
    echo "Deleting Python $PYTHON_FULL_VERSION"
    rm -rf $PYTHON_TOOLCACHE_VERSION_PATH
fi

echo "Create Python $PYTHON_FULL_VERSION folder"
mkdir -p $PYTHON_TOOLCACHE_VERSION_ARCH_PATH

echo "Copy Python binaries to hostedtoolcache folder"
cp -R ./* $PYTHON_TOOLCACHE_VERSION_ARCH_PATH
rm $PYTHON_TOOLCACHE_VERSION_ARCH_PATH/linux_setup.sh

cd $PYTHON_TOOLCACHE_VERSION_ARCH_PATH

echo "Create additional symlinks (Required for the UsePythonVersion Azure Pipelines task and the setup-python GitHub Action)"
ln -s ./bin/$PYTHON_MAJOR_DOT_MINOR python

# display pwd
echo "Current directory: $(pwd)"

# display files in current directory
echo "Files in current directory:"

cd bin/
ln -s $PYTHON_MAJOR_DOT_MINOR $PYTHON_MAJORMINOR
if [ ! -f python ]; then
    ln -s $PYTHON_MAJOR_DOT_MINOR python
fi

chmod +x ../python $PYTHON_MAJOR $PYTHON_MAJOR_DOT_MINOR $PYTHON_MAJORMINOR python

echo "Upgrading pip..."
export PIP_ROOT_USER_ACTION=ignore
./python -m ensurepip
./python -m pip install --upgrade --force-reinstall pip --disable-pip-version-check --no-warn-script-location

echo "Create complete file"
touch $PYTHON_TOOLCACHE_VERSION_PATH/$ARCH.complete