import { getNamedType, isObjectType } from 'graphql';
export function forEachField(schema, fn) {
    const typeMap = schema.getTypeMap();
    Object.keys(typeMap).forEach(typeName => {
        const type = typeMap[typeName];
        // TODO: maybe have an option to include these?
        if (!getNamedType(type).name.startsWith('__') && isObjectType(type)) {
            const fields = type.getFields();
            Object.keys(fields).forEach(fieldName => {
                const field = fields[fieldName];
                fn(field, typeName, fieldName);
            });
        }
    });
}
//# sourceMappingURL=forEachField.js.map