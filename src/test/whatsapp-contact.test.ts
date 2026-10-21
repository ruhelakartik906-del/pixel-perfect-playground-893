import { describe, it, expect } from 'vitest';
import { waContactInput, waContactE164 } from '@/lib/messaging';

describe('waContactInput', () => {
  it('rejects an empty client name', () => {
    expect(waContactInput.safeParse({ name: ' ', countryCode: '+91', phone: '9811022334' }).success).toBe(false);
  });
  it('rejects a country code starting with 0', () => {
    expect(waContactInput.safeParse({ name: 'Asha', countryCode: '+091', phone: '9811022334' }).success).toBe(false);
  });
  it('rejects a number containing letters', () => {
    expect(waContactInput.safeParse({ name: 'Asha', countryCode: '+91', phone: '98110abcde' }).success).toBe(false);
  });
  it('accepts a valid name, country code and number', () => {
    expect(waContactInput.safeParse({ name: 'Asha Rao', countryCode: '+91', phone: '9811022334' }).success).toBe(true);
  });
});

describe('waContactE164', () => {
  it('combines country code and number into digits only', () => {
    expect(waContactE164({ countryCode: '+91', phone: '9811022334' })).toBe('919811022334');
  });
  it('strips a leading zero from the local number', () => {
    expect(waContactE164({ countryCode: '+44', phone: '07911123456' })).toBe('447911123456');
  });
  it('returns null when the combined number is too short', () => {
    expect(waContactE164({ countryCode: '+91', phone: '12345' })).toBeNull();
  });
  it('returns null when the combined number exceeds 15 digits', () => {
    expect(waContactE164({ countryCode: '+91', phone: '123456789012345678' })).toBeNull();
  });
});
