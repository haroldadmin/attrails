export function envOrThrow(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Environment variable ${name} not defined`);
  }

  return value;
}
