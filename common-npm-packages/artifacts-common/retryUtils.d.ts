export declare function retryOnException<T>(action: () => Promise<T>, maxTries: number, retryIntervalInMilliseconds: number): Promise<T>;
