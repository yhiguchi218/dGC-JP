import { REVIEW_AUTH_CONFIG } from './review-auth-config';

export const REVIEW_AUTH_STORAGE_KEY = 'dgc_jp_review_auth_v2';

type ReviewAuthSession = {
  authenticated: true;
  version: string;
};

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

export async function deriveReviewVerifier(password: string, salt: string, iterations: number): Promise<string> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

export function timingSafeEqual(first: Uint8Array, second: Uint8Array): boolean {
  if (first.length !== second.length) return false;

  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first[index] ^ second[index];
  }
  return difference === 0;
}

export async function verifyReviewCode(password: string): Promise<boolean> {
  const derivedVerifier = await deriveReviewVerifier(
    password,
    REVIEW_AUTH_CONFIG.salt,
    REVIEW_AUTH_CONFIG.iterations
  );
  return timingSafeEqual(base64ToBytes(derivedVerifier), base64ToBytes(REVIEW_AUTH_CONFIG.verifier));
}

export function createReviewAuthSession(): string {
  const session: ReviewAuthSession = {
    authenticated: true,
    version: REVIEW_AUTH_CONFIG.version,
  };
  return JSON.stringify(session);
}

export function isReviewAuthSessionValid(value: string | null): boolean {
  if (!value) return false;

  try {
    const session = JSON.parse(value) as Partial<ReviewAuthSession>;
    return session.authenticated === true && session.version === REVIEW_AUTH_CONFIG.version;
  } catch {
    return false;
  }
}