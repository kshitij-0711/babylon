import { Prisma } from 'prisma-client';
type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

export function serialiseDecimal(value: Decimal | null | undefined): string | null {
  if (value == null) return null;
  return value.toString();
}

export function serialiseDecimals<T extends Record<string, any>>(obj: T, keys: string[]): T {
  const result = { ...obj } as any;
  for (const key of keys) {
    if (result[key] != null && typeof result[key].toString === 'function') {
      result[key] = result[key].toString();
    }
  }
  return result;
}
