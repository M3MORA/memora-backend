import { Expose } from 'class-transformer';
import { IsIn } from 'class-validator';

export const NODE_ENVS = ['development', 'production', 'test'] as const;
export type NodeEnvName = (typeof NODE_ENVS)[number];

export class NodeEnvironment {
  @Expose()
  @IsIn(NODE_ENVS)
  NODE_ENV!: NodeEnvName;
}
