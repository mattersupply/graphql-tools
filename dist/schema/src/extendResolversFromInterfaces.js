export function extendResolversFromInterfaces(schema, resolvers) {
    const typeNames = Object.keys({
        ...schema.getTypeMap(),
        ...resolvers,
    });
    const extendedResolvers = {};
    typeNames.forEach(typeName => {
        const type = schema.getType(typeName);
        if ('getInterfaces' in type) {
            const allInterfaceResolvers = type
                .getInterfaces()
                .map(iFace => resolvers[iFace.name])
                .filter(interfaceResolvers => interfaceResolvers != null);
            extendedResolvers[typeName] = {};
            allInterfaceResolvers.forEach(interfaceResolvers => {
                Object.keys(interfaceResolvers).forEach(fieldName => {
                    if (fieldName === '__isTypeOf' || !fieldName.startsWith('__')) {
                        extendedResolvers[typeName][fieldName] = interfaceResolvers[fieldName];
                    }
                });
            });
            const typeResolvers = resolvers[typeName];
            extendedResolvers[typeName] = {
                ...extendedResolvers[typeName],
                ...typeResolvers,
            };
        }
        else {
            const typeResolvers = resolvers[typeName];
            if (typeResolvers != null) {
                extendedResolvers[typeName] = typeResolvers;
            }
        }
    });
    return extendedResolvers;
}
//# sourceMappingURL=extendResolversFromInterfaces.js.map