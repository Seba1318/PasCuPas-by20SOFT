// Verificare minimă de formă pentru răspunsurile API (fără biblioteci).
// Schema: { câmp: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any' | /regex/ | [schemaElement] | { ... } },
// prefixul '?' face câmpul opțional / nullable.
export function checkShape(value, schema, path = '') {
  const errors = [];
  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) return [`${path || 'răspuns'}: trebuia listă`];
    value.slice(0, 5).forEach((v, i) => errors.push(...checkShape(v, schema[0], `${path}[${i}]`)));
    return errors;
  }
  if (schema instanceof RegExp) return typeof value === 'string' && schema.test(value) ? [] : [`${path}: „${value}” nu se potrivește cu ${schema}`];
  if (typeof schema === 'string') {
    const optional = schema.startsWith('?');
    const type = schema.replace('?', '');
    if (value == null) return optional ? [] : [`${path}: lipsește`];
    if (type === 'any') return [];
    const actual = Array.isArray(value) ? 'array' : typeof value;
    return actual === type ? [] : [`${path}: trebuia ${type}, e ${actual}`];
  }
  if (value == null || typeof value !== 'object') return [`${path || 'răspuns'}: trebuia obiect`];
  for (const [key, sub] of Object.entries(schema)) errors.push(...checkShape(value[key], sub, path ? `${path}.${key}` : key));
  return errors;
}
