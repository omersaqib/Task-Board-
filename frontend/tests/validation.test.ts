import { describe, expect, it } from 'vitest';
import { hasErrors, validateLogin, validateRegister, validateTask } from '../src/lib/validation';

describe('validateLogin', () => {
  it('requires email and password', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Email is required',
      password: 'Password is required',
    });
  });

  it('rejects malformed emails', () => {
    expect(validateLogin({ email: 'nope', password: 'x' }).email).toBe(
      'Enter a valid email address',
    );
  });

  it('accepts valid input', () => {
    expect(hasErrors(validateLogin({ email: ' a@b.co ', password: 'x' }))).toBe(false);
  });
});

describe('validateRegister', () => {
  const valid = {
    name: 'Ada',
    email: 'ada@example.com',
    password: 'Passw0rd',
    confirmPassword: 'Passw0rd',
  };

  it('accepts valid input', () => {
    expect(validateRegister(valid)).toEqual({});
  });

  it('enforces password rules', () => {
    expect(
      validateRegister({ ...valid, password: 'short1', confirmPassword: 'short1' }).password,
    ).toBe('Password must be at least 8 characters');
    expect(
      validateRegister({ ...valid, password: 'allletters', confirmPassword: 'allletters' })
        .password,
    ).toBe('Password must contain a letter and a number');
  });

  it('requires matching confirmation and a name', () => {
    const errors = validateRegister({ ...valid, name: '  ', confirmPassword: 'different1' });
    expect(errors.name).toBe('Name is required');
    expect(errors.confirmPassword).toBe('Passwords do not match');
  });
});

describe('validateTask', () => {
  it('requires a non-blank title', () => {
    expect(validateTask({ title: '   ', description: '' }).title).toBe('Title is required');
  });

  it('limits title and description length', () => {
    const errors = validateTask({ title: 'x'.repeat(121), description: 'y'.repeat(2001) });
    expect(errors.title).toMatch(/at most 120/);
    expect(errors.description).toMatch(/at most 2000/);
  });
});
