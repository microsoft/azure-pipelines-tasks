for /D %%s in (.\*) do ( 
pushd %%s
push.cmd
popd
)