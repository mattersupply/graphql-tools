import { mergeDeep } from '@graphql-tools/utils';
export function mergeResolvers(resolversDefinitions, options) {
    if (!resolversDefinitions || resolversDefinitions.length === 0) {
        return {};
    }
    if (resolversDefinitions.length === 1) {
        return resolversDefinitions[0];
    }
    const resolversFactories = new Array();
    const resolvers = new Array();
    for (const resolversDefinition of resolversDefinitions) {
        if (typeof resolversDefinition === 'function') {
            resolversFactories.push(resolversDefinition);
        }
        else if (typeof resolversDefinition === 'object') {
            resolvers.push(resolversDefinition);
        }
    }
    let result = {};
    if (resolversFactories.length) {
        result = ((...args) => {
            const resultsOfFactories = resolversFactories.map(factory => factory(...args));
            return resolvers.concat(resultsOfFactories).reduce(mergeDeep, {});
        });
    }
    else {
        result = resolvers.reduce(mergeDeep, {});
    }
    if (options && options.exclusions) {
        for (const exclusion of options.exclusions) {
            const [typeName, fieldName] = exclusion.split('.');
            if (!fieldName || fieldName === '*') {
                delete result[typeName];
            }
            else if (result[typeName]) {
                delete result[typeName][fieldName];
            }
        }
    }
    return result;
}
//# sourceMappingURL=merge-resolvers.js.map