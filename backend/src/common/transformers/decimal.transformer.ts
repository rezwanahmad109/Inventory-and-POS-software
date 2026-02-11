import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to(value?: number): number | null {
    if (value === undefined || value === null) return null;
    return Number(value);
  },
  from(value: string | null): number | null {
    if (value === null) return null;
    return Number(value);
  },
};
