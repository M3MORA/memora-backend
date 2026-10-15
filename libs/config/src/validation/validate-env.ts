import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';

export function validateEnv<T extends object>(
  EnvClass: new () => T,
  source: NodeJS.ProcessEnv | Record<string, unknown>,
): T {
  const validated = plainToInstance(EnvClass, source, {
    enableImplicitConversion: false,
    excludeExtraneousValues: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${formatValidationErrors(errors)}`,
    );
  }

  return validated;
}

function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((error) => {
      const constraints = Object.values(error.constraints ?? {});
      if (constraints.length > 0) {
        return `${error.property}: ${constraints.join(', ')}`;
      }

      if (error.children?.length) {
        return formatValidationErrors(error.children);
      }

      return error.property;
    })
    .join('; ');
}
