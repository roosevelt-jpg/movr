/** Global gender options — ISO-style codes, never free-text. */
export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export type GenderValue = (typeof GENDER_OPTIONS)[number]['value'] | '';

export function genderLabel(value?: string | null) {
  const hit = GENDER_OPTIONS.find((g) => g.value === value);
  return hit?.label || '';
}
