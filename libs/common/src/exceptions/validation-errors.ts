import type { ValidationError } from '@nestjs/common';
import type { ValidationFieldError } from './error-codes';

export function flattenValidationErrors(
  errors: ValidationError[],
  parent?: string,
): ValidationFieldError[] {
  const fields: ValidationFieldError[] = [];

  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});

    if (messages.length > 0) {
      fields.push({ field, messages });
    }

    if (error.children && error.children.length > 0) {
      fields.push(...flattenValidationErrors(error.children, field));
    }
  }

  return fields;
}
