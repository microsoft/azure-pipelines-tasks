/* 
    Proxy function using to mute console.log from toolrunner
    to clean output. Also it could be improved if necessary to write output in to variable  
*/
export function setToolProxy(tl) {
    return new Proxy(tl, {
        apply(target, thisArg, args) {
          const toolRunner = target.apply(thisArg, args);
          toolRunner.exec = new Proxy(toolRunner.exec, {
            apply(target, thisArg, args) {
                const outStrem = { 
                    outStream: {
                        write: (msg) => null
                    }
                };
                if (!args.length) {
                    args.push(outStrem);
                }
                else {
                    args[0] = Object.assign(args[0], outStrem);
                }
                return target.apply(thisArg, args);
            }
          });
    
          return toolRunner;
        }
    });
}