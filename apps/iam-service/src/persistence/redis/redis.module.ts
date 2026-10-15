import { Module } from '@nestjs/common';
import { RedisPurposeTokenStore } from './purpose-token.store';
import { RedisRefreshSessionStore } from './refresh-session.store';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService, RedisRefreshSessionStore, RedisPurposeTokenStore],
  exports: [RedisService, RedisRefreshSessionStore, RedisPurposeTokenStore],
})
export class RedisModule {}
