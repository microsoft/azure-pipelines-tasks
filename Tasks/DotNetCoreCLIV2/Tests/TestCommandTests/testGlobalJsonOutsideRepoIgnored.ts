tr.registerMockFs({
    '/outside': {
        'global.json': JSON.stringify({
            test: { runner: 'Microsoft.Testing.Platform' }
        })
    },
    [process.env['BUILD_SOURCESDIRECTORY']]: {
        src: { 'test.csproj': '' }
    }
});
