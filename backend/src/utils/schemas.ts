import { z } from 'zod';

/**
 * Form inputs send '' for untouched optional fields. Without this, a client
 * created through the UI fails validation with "Email inválido" because
 * z.string().email() rejects an empty string.
 *
 * Convert '' → null before validating.
 */
const emptyToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

export const optionalString = z.preprocess(
  emptyToNull,
  z.string().min(1).optional().nullable()
);

export const optionalEmail = z.preprocess(
  emptyToNull,
  z.string().email('Email inválido').optional().nullable()
);

export const optionalPhone = z.preprocess(
  emptyToNull,
  z.string().min(1).optional().nullable()
);
