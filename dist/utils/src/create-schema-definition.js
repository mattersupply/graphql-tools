export function createSchemaDefinition(def, config) {
    const schemaRoot = {};
    if (def.query) {
        schemaRoot.query = def.query.toString();
    }
    if (def.mutation) {
        schemaRoot.mutation = def.mutation.toString();
    }
    if (def.subscription) {
        schemaRoot.subscription = def.subscription.toString();
    }
    const fields = Object.keys(schemaRoot)
        .map(rootType => (schemaRoot[rootType] ? `${rootType}: ${schemaRoot[rootType]}` : null))
        .filter(a => a);
    if (fields.length) {
        return `schema { ${fields.join('\n')} }`;
    }
    if (config && config.force) {
        return ` schema { query: Query } `;
    }
    return undefined;
}
//# sourceMappingURL=create-schema-definition.js.map