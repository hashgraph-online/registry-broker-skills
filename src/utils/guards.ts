export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function getBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

