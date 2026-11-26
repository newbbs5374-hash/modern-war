// 전장 목록. 새 전장(해상·공중·육상·육+공·해+공·해+육)은 여기에 파일 하나씩 더하면 됨.
import type { FieldConfig } from '../field';
import { COAST } from './coast';

export const FIELDS: Record<string, FieldConfig> = { coast: COAST };
export const fieldById = (id: string): FieldConfig => FIELDS[id] ?? COAST;
