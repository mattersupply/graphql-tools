import { chainFunctions } from './chain-functions';
import { get, set, flatten } from 'lodash';
import { isScalarType } from 'graphql';
import { asArray } from '@graphql-tools/utils';
function resolveRelevantMappings(resolvers, path, allMappings) {
    const splitted = path.split('.');
    if (splitted.length === 2) {
        const typeName = splitted[0];
        if (isScalarType(resolvers[typeName])) {
            return [];
        }
        const fieldName = splitted[1];
        if (typeName === '*') {
            return flatten(Object.keys(resolvers).map(typeName => resolveRelevantMappings(resolvers, `${typeName}.${fieldName}`, allMappings)));
        }
        if (fieldName === '*') {
            return flatten(Object.keys(resolvers[typeName]).map(field => resolveRelevantMappings(resolvers, `${typeName}.${field}`, allMappings))).filter(mapItem => !allMappings[mapItem]);
        }
        else {
            const paths = [];
            if (resolvers[typeName] && resolvers[typeName][fieldName]) {
                if (resolvers[typeName][fieldName].subscribe) {
                    paths.push(path + '.subscribe');
                }
                if (resolvers[typeName][fieldName].resolve) {
                    paths.push(path + '.resolve');
                }
                if (typeof resolvers[typeName][fieldName] === 'function') {
                    paths.push(path);
                }
            }
            return paths;
        }
    }
    else if (splitted.length === 1) {
        const typeName = splitted[0];
        return flatten(Object.keys(resolvers[typeName]).map(fieldName => resolveRelevantMappings(resolvers, `${typeName}.${fieldName}`, allMappings)));
    }
    return [];
}
/**
 * Wraps the resolvers object with the resolvers composition objects.
 * Implemented as a simple and basic middleware mechanism.
 *
 * @param resolvers - resolvers object
 * @param mapping - resolvers composition mapping
 * @hidden
 */
export function composeResolvers(resolvers, mapping = {}) {
    const mappingResult = {};
    Object.keys(mapping).map((resolverPath) => {
        if (mapping[resolverPath] instanceof Array || typeof mapping[resolverPath] === 'function') {
            const composeFns = mapping[resolverPath];
            const relevantFields = resolveRelevantMappings(resolvers, resolverPath, mapping);
            relevantFields.forEach((path) => {
                mappingResult[path] = asArray(composeFns);
            });
        }
        else {
            Object.keys(mapping[resolverPath]).forEach(fieldName => {
                const composeFns = mapping[resolverPath][fieldName];
                const relevantFields = resolveRelevantMappings(resolvers, resolverPath + '.' + fieldName, mapping);
                relevantFields.forEach((path) => {
                    mappingResult[path] = asArray(composeFns);
                });
            });
        }
    });
    Object.keys(mappingResult).forEach(path => {
        const fns = chainFunctions([...asArray(mappingResult[path]), () => get(resolvers, path)]);
        set(resolvers, path, fns());
    });
    return resolvers;
}
//# sourceMappingURL=resolvers-composition.js.map