import { Kind } from 'graphql';
export function extractExtensionDefinitions(ast) {
    const extensionDefs = ast.definitions.filter((def) => def.kind === Kind.OBJECT_TYPE_EXTENSION ||
        def.kind === Kind.INTERFACE_TYPE_EXTENSION ||
        def.kind === Kind.INPUT_OBJECT_TYPE_EXTENSION ||
        def.kind === Kind.UNION_TYPE_EXTENSION ||
        def.kind === Kind.ENUM_TYPE_EXTENSION ||
        def.kind === Kind.SCALAR_TYPE_EXTENSION ||
        def.kind === Kind.SCHEMA_EXTENSION);
    return {
        ...ast,
        definitions: extensionDefs,
    };
}
export function filterExtensionDefinitions(ast) {
    const extensionDefs = ast.definitions.filter((def) => def.kind !== Kind.OBJECT_TYPE_EXTENSION &&
        def.kind !== Kind.INTERFACE_TYPE_EXTENSION &&
        def.kind !== Kind.INPUT_OBJECT_TYPE_EXTENSION &&
        def.kind !== Kind.UNION_TYPE_EXTENSION &&
        def.kind !== Kind.ENUM_TYPE_EXTENSION &&
        def.kind !== Kind.SCALAR_TYPE_EXTENSION &&
        def.kind !== Kind.SCHEMA_EXTENSION);
    return {
        ...ast,
        definitions: extensionDefs,
    };
}
//# sourceMappingURL=extensionDefinitions.js.map