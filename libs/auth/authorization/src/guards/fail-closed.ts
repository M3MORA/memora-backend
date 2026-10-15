import { HttpException, ServiceUnavailableException } from '@nestjs/common';

export async function resolveAuthorizationSource<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof HttpException) {
      throw error;
    }
    throw new ServiceUnavailableException('Authorization provider unavailable');
  }
}
