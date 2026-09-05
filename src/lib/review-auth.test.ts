// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  createReviewAuthSession,
  deriveReviewVerifier,
  isReviewAuthSessionValid,
  timingSafeEqual,
} from './review-auth';
import { REVIEW_AUTH_CONFIG } from './review-auth-config';

const TEST_SALT = 'MDEyMzQ1Njc4OWFiY2RlZg==';

describe('review authentication helpers', () => {
  it('derives the same verifier for identical inputs and different verifiers for different passwords', async () => {
    const first = await deriveReviewVerifier('test-review-code', TEST_SALT, 1);
    const second = await deriveReviewVerifier('test-review-code', TEST_SALT, 1);
    const different = await deriveReviewVerifier('different-review-code', TEST_SALT, 1);

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it('compares matching and non-matching verifier bytes', async () => {
    const verifier = await deriveReviewVerifier('test-review-code', TEST_SALT, 1);
    const matching = Uint8Array.from(atob(verifier), (character) => character.charCodeAt(0));
    const different = Uint8Array.from(atob(await deriveReviewVerifier('different-review-code', TEST_SALT, 1)), (character) => character.charCodeAt(0));

    expect(timingSafeEqual(matching, matching)).toBe(true);
    expect(timingSafeEqual(matching, different)).toBe(false);
  });

  it('accepts only the current review authentication session version', () => {
    expect(isReviewAuthSessionValid(createReviewAuthSession())).toBe(true);
    expect(isReviewAuthSessionValid(JSON.stringify({ authenticated: true, version: '1' }))).toBe(false);
  });

  it('stores only verifier configuration, not a plaintext password', () => {
    expect(REVIEW_AUTH_CONFIG.salt).toBeTruthy();
    expect(REVIEW_AUTH_CONFIG.verifier).toBeTruthy();
    expect(Object.keys(REVIEW_AUTH_CONFIG)).toEqual(['version', 'salt', 'iterations', 'verifier']);
  });
});