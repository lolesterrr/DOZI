import { randomUUID } from 'expo-crypto';

/** A new UUID v4, generated on the device. Use for every row id. */
export function newId(): string {
  return randomUUID();
}
