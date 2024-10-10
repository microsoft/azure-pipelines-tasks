export interface RequestOptions {
    socketTimeout?: number;
    globalAgentOptions?: { 
        keepAlive?: boolean;
        timeout?: number;
    }
}