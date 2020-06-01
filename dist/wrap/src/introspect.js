import { getIntrospectionQuery, buildClientSchema, parse, } from 'graphql';
import { CombinedError } from '@graphql-tools/utils';
function getSchemaFromIntrospection(introspectionResult) {
    var _a, _b;
    if ((_a = introspectionResult === null || introspectionResult === void 0 ? void 0 : introspectionResult.data) === null || _a === void 0 ? void 0 : _a.__schema) {
        return buildClientSchema(introspectionResult.data);
    }
    else if ((_b = introspectionResult === null || introspectionResult === void 0 ? void 0 : introspectionResult.errors) === null || _b === void 0 ? void 0 : _b.length) {
        if (introspectionResult.errors.length > 1) {
            const combinedError = new CombinedError(introspectionResult.errors);
            throw combinedError;
        }
        const error = introspectionResult.errors[0];
        throw error.originalError || error;
    }
    else {
        throw new Error('Could not obtain introspection result, received: ' + JSON.stringify(introspectionResult));
    }
}
export async function introspectSchema(executor, context) {
    const parsedIntrospectionQuery = parse(getIntrospectionQuery());
    const introspectionResult = await executor({
        document: parsedIntrospectionQuery,
        context,
    });
    return getSchemaFromIntrospection(introspectionResult);
}
export function introspectSchemaSync(executor, context) {
    const parsedIntrospectionQuery = parse(getIntrospectionQuery());
    const introspectionResult = executor({
        document: parsedIntrospectionQuery,
        context,
    });
    if ('then' in introspectionResult) {
        throw new Error(`Executor cannot return promise value in introspectSchemaSync!`);
    }
    return getSchemaFromIntrospection(introspectionResult);
}
//# sourceMappingURL=introspect.js.map