import { Kind } from 'graphql';
export function extractTypeDefinitions(ast) {
    const typeDefs = ast.definitions.filter((def) => def.kind === Kind.OBJECT_TYPE_DEFINITION ||
        def.kind === Kind.INTERFACE_TYPE_DEFINITION ||
        def.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
        def.kind === Kind.UNION_TYPE_DEFINITION ||
        def.kind === Kind.ENUM_TYPE_DEFINITION ||
        def.kind === Kind.SCALAR_TYPE_DEFINITION);
    return {
        ...ast,
        definitions: typeDefs,
    };
}
export function extractDirectiveDefinitions(ast) {
    const directiveDefs = ast.definitions.filter((def) => def.kind === Kind.DIRECTIVE_DEFINITION);
    return {
        ...ast,
        definitions: directiveDefs,
    };
}
export function extractSchemaDefinition(ast) {
    const schemaDefs = ast.definitions.filter((def) => def.kind === Kind.SCHEMA_DEFINITION);
    return schemaDefs.length ? schemaDefs[schemaDefs.length - 1] : null;
}
export function extractSchemaExtensions(ast) {
    const schemaExtensions = ast.definitions.filter((def) => def.kind === Kind.SCHEMA_EXTENSION);
    return schemaExtensions;
}
export function extractTypeExtensionDefinitions(ast) {
    const extensionDefs = ast.definitions.filter((def) => def.kind === Kind.OBJECT_TYPE_EXTENSION ||
        def.kind === Kind.INTERFACE_TYPE_EXTENSION ||
        def.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION ||
        def.kind === Kind.UNION_TYPE_EXTENSION ||
        def.kind === Kind.ENUM_TYPE_EXTENSION ||
        def.kind === Kind.SCALAR_TYPE_EXTENSION);
    return {
        ...ast,
        definitions: extensionDefs,
    };
}
//# sourceMappingURL=definitions.js.map