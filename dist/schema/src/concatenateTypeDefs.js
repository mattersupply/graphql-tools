import { print } from 'graphql';
export function concatenateTypeDefs(typeDefinitionsAry, calledFunctionRefs = []) {
    let resolvedTypeDefinitions = [];
    typeDefinitionsAry.forEach((typeDef) => {
        if (typeof typeDef === 'function') {
            if (calledFunctionRefs.indexOf(typeDef) === -1) {
                calledFunctionRefs.push(typeDef);
                resolvedTypeDefinitions = resolvedTypeDefinitions.concat(concatenateTypeDefs(typeDef(), calledFunctionRefs));
            }
        }
        else if (typeof typeDef === 'string') {
            resolvedTypeDefinitions.push(typeDef.trim());
        }
        else if (typeDef.kind !== undefined) {
            resolvedTypeDefinitions.push(print(typeDef).trim());
        }
        else {
            const type = typeof typeDef;
            throw new Error(`typeDef array must contain only strings, documents, or functions, got ${type}`);
        }
    });
    return uniq(resolvedTypeDefinitions.map(x => x.trim())).join('\n');
}
function uniq(array) {
    return array.reduce((accumulator, currentValue) => accumulator.indexOf(currentValue) === -1 ? [...accumulator, currentValue] : accumulator, []);
}
//# sourceMappingURL=concatenateTypeDefs.js.map