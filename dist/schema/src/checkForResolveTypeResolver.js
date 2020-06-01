import { isAbstractType } from 'graphql';
// If we have any union or interface types throw if no there is no resolveType or isTypeOf resolvers
export function checkForResolveTypeResolver(schema, requireResolversForResolveType) {
    Object.keys(schema.getTypeMap())
        .map(typeName => schema.getType(typeName))
        .forEach((type) => {
        if (!isAbstractType(type)) {
            return;
        }
        if (!type.resolveType) {
            if (!requireResolversForResolveType) {
                return;
            }
            throw new Error(`Type "${type.name}" is missing a "__resolveType" resolver. Pass false into ` +
                '"resolverValidationOptions.requireResolversForResolveType" to disable this error.');
        }
    });
}
//# sourceMappingURL=checkForResolveTypeResolver.js.map