import { parse, extendSchema, buildASTSchema } from 'graphql';
import { extractExtensionDefinitions, filterExtensionDefinitions } from './extensionDefinitions';
import { concatenateTypeDefs } from './concatenateTypeDefs';
export function buildSchemaFromTypeDefinitions(typeDefinitions, parseOptions) {
    const document = buildDocumentFromTypeDefinitions(typeDefinitions, parseOptions);
    const typesAst = filterExtensionDefinitions(document);
    const backcompatOptions = { commentDescriptions: true };
    let schema = buildASTSchema(typesAst, backcompatOptions);
    const extensionsAst = extractExtensionDefinitions(document);
    if (extensionsAst.definitions.length > 0) {
        schema = extendSchema(schema, extensionsAst, backcompatOptions);
    }
    return schema;
}
export function isDocumentNode(typeDefinitions) {
    return typeDefinitions.kind !== undefined;
}
export function buildDocumentFromTypeDefinitions(typeDefinitions, parseOptions) {
    let document;
    if (typeof typeDefinitions === 'string') {
        document = parse(typeDefinitions, parseOptions);
    }
    else if (Array.isArray(typeDefinitions)) {
        document = parse(concatenateTypeDefs(typeDefinitions), parseOptions);
    }
    else if (isDocumentNode(typeDefinitions)) {
        document = typeDefinitions;
    }
    else {
        const type = typeof typeDefinitions;
        throw new Error(`typeDefs must be a string, array or schema AST, got ${type}`);
    }
    return document;
}
//# sourceMappingURL=buildSchemaFromTypeDefinitions.js.map