import {Filter} from '@loopback/repository';

type PlainObject = {[key: string]: unknown};

/** Parse LB query `filter` and normalize LB3 include forms to LB4 include relation objects. */
export function parseLegacyQueryFilter<T extends object>(rawFilter: unknown): Filter<T> | undefined {
  const parsed = parseFilterInput(rawFilter);
  if (!parsed) {
    return undefined;
  }

  const normalized: PlainObject = {...parsed};
  if ('include' in normalized) {
    const include = normalizeInclude(normalized.include);
    if (include && include.length > 0) {
      normalized.include = include;
    } else {
      delete normalized.include;
    }
  }

  return normalized as Filter<T>;
}

function parseFilterInput(rawFilter: unknown): PlainObject | undefined {
  if (rawFilter === null || rawFilter === undefined || rawFilter === '') {
    return undefined;
  }

  if (typeof rawFilter === 'string') {
    const trimmed = rawFilter.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return isPlainObject(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return isPlainObject(rawFilter) ? rawFilter : undefined;
}

function normalizeInclude(include: unknown): PlainObject[] | undefined {
  if (include === null || include === undefined || include === '') {
    return undefined;
  }

  if (typeof include === 'string') {
    return [{relation: include}];
  }

  if (Array.isArray(include)) {
    const flattened = include.flatMap(value => normalizeIncludeValue(value));
    return flattened.length ? flattened : undefined;
  }

  if (!isPlainObject(include)) {
    return undefined;
  }

  if (hasOnlyNumericKeys(include)) {
    const values = Object.keys(include)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => include[key]);
    const flattened = values.flatMap(value => normalizeIncludeValue(value));
    return flattened.length ? flattened : undefined;
  }

  const byRelationKey = normalizeIncludeObjectByRelationKeys(include);
  if (byRelationKey.length) {
    return byRelationKey;
  }

  const single = normalizeIncludeItem(include);
  return single ? [single] : undefined;
}

function normalizeIncludeObjectByRelationKeys(include: PlainObject): PlainObject[] {
  if ('relation' in include || 'model' in include) {
    return [];
  }
  const keys = Object.keys(include);
  if (!keys.length) {
    return [];
  }
  return keys.map(relation => {
    const value = include[relation];
    if (isPlainObject(value)) {
      return {relation, scope: value};
    }
    if (value === true || value === undefined || value === null) {
      return {relation};
    }
    return {relation, scope: value};
  });
}

function normalizeIncludeValue(value: unknown): PlainObject[] {
  if (typeof value === 'string') {
    return [{relation: value}];
  }
  const normalized = normalizeIncludeItem(value);
  return normalized ? [normalized] : [];
}

function normalizeIncludeItem(value: unknown): PlainObject | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  if (typeof value.relation === 'string') {
    return value;
  }

  if (typeof value.model === 'string') {
    const {model, ...rest} = value;
    return {relation: model, ...rest};
  }

  const keys = Object.keys(value);
  if (keys.length === 1) {
    const relation = keys[0];
    const scope = value[relation];
    if (isPlainObject(scope)) {
      return {relation, scope};
    }
    if (scope === true || scope === undefined || scope === null) {
      return {relation};
    }
    return {relation, scope};
  }

  return undefined;
}

function hasOnlyNumericKeys(value: PlainObject): boolean {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every(key => /^\d+$/.test(key));
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
