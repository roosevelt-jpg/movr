import tokens from './tokens.json';

export const colors = tokens.colors;
export const gradient = tokens.gradient;
export const spacing = tokens.spacing;
export const radius = tokens.radius;
export const elevation = tokens.elevation;
export const typography = tokens.typography;
export const adminDensity = (tokens as any).adminDensity;
export const marketing = (tokens as any).marketing;

export const theme = {
  colors,
  gradient,
  spacing,
  radius,
  elevation,
  typography,
  adminDensity,
  marketing,
} as const;

export type MovrTheme = typeof theme;

export default theme;
