import * as stream from 'stream';

export default class EchoStream extends stream.Writable {
  public content: string = "";
  _write(chunk, enc, next) {
    let s = chunk.toString();
    console.log(s);
    this.content += s;
    next();
  }
}