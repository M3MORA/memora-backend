import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { argon2id, argon2Verify } from 'hash-wasm';

const ARGON2ID_OPTIONS = {
  parallelism: 1,
  iterations: 2,
  memorySize: 19_456,
  hashLength: 32,
  outputType: 'encoded',
} as const;

@Injectable()
export class PasswordHasher {
  async hash(plain: string): Promise<string> {
    return argon2id({
      password: plain,
      salt: randomBytes(16),
      ...ARGON2ID_OPTIONS,
    });
  }

  async verify(encodedHash: string, plain: string): Promise<boolean> {
    try {
      return await argon2Verify({
        password: plain,
        hash: encodedHash,
      });
    } catch {
      return false;
    }
  }
}
