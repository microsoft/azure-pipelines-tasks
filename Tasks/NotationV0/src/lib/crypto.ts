import * as crypto from 'crypto';
import * as fs from 'fs';

// compute the checksum of the file
export async function computeChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => {
      hash.update(data);
    });

    stream.on('end', () => {
      const result = hash.digest('hex');
      resolve(result);
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}
