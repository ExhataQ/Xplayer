// A small checker for the JSON-Schema subset the AI actions use: type, enum, required,
// additionalProperties:false, min/max Length, min/max Items, minimum/maximum, items, properties.
// Written here so the model's reply is never trusted without a check, and no dependency is added.

function typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (Number.isInteger(value)) return 'integer';
    return typeof value;
}

function matchesType(value, type) {
    const actual = typeOf(value);
    if (type === 'number') return actual === 'number' || actual === 'integer';
    return actual === type;
}

// Returns a list of readable problems; an empty list means the value fits the schema.
function validate(value, schema, where = 'value') {
    const errors = [];
    if (schema.type && !matchesType(value, schema.type)) {
        return [`${where} must be ${schema.type}, got ${typeOf(value)}`];
    }
    if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${where} must be one of: ${schema.enum.join(', ')}`);
    }
    if (typeof value === 'string') {
        if (schema.minLength !== undefined && value.trim().length < schema.minLength) errors.push(`${where} is too short`);
        if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${where} is longer than ${schema.maxLength} characters`);
    }
    if (typeof value === 'number') {
        if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${where} must be at least ${schema.minimum}`);
        if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${where} must be at most ${schema.maximum}`);
    }
    if (Array.isArray(value)) {
        if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${where} needs at least ${schema.minItems} items`);
        if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${where} has more than ${schema.maxItems} items`);
        if (schema.items) {
            value.forEach((item, i) => errors.push(...validate(item, schema.items, `${where}[${i}]`)));
        }
    }
    if (typeOf(value) === 'object') {
        const props = schema.properties || {};
        for (const key of schema.required || []) {
            if (!(key in value)) errors.push(`${where}.${key} is missing`);
        }
        for (const key of Object.keys(value)) {
            if (props[key]) errors.push(...validate(value[key], props[key], `${where}.${key}`));
            else if (schema.additionalProperties === false) errors.push(`${where}.${key} is not allowed`);
        }
    }
    return errors;
}

module.exports = { validate, typeOf };
