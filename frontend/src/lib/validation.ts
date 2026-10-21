export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: { email: string; password: string }) {
  const errors: FieldErrors<'email' | 'password'> = {};
  if (!input.email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_PATTERN.test(input.email.trim())) errors.email = 'Enter a valid email address';
  if (!input.password) errors.password = 'Password is required';
  return errors;
}

export function validateRegister(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}) {
  const errors: FieldErrors<'name' | 'email' | 'password' | 'confirmPassword'> = {
    ...validateLogin(input),
  };
  if (!input.name.trim()) errors.name = 'Name is required';
  else if (input.name.trim().length > 80) errors.name = 'Name must be at most 80 characters';

  if (input.password) {
    if (input.password.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (!/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) {
      errors.password = 'Password must contain a letter and a number';
    }
  }
  if (input.confirmPassword !== input.password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}

export function validateTask(input: { title: string; description: string }) {
  const errors: FieldErrors<'title' | 'description'> = {};
  const title = input.title.trim();
  if (!title) errors.title = 'Title is required';
  else if (title.length > 120) errors.title = 'Title must be at most 120 characters';
  if (input.description.trim().length > 2000) {
    errors.description = 'Description must be at most 2000 characters';
  }
  return errors;
}

export const hasErrors = (errors: object) => Object.keys(errors).length > 0;
