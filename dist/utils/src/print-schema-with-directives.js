import { print, printType, Kind, isSpecifiedScalarType, isIntrospectionType, isScalarType, parse, } from 'graphql';
import { createSchemaDefinition } from './create-schema-definition';
export function printSchemaWithDirectives(schema, _options = {}) {
    var _a;
    const typesMap = schema.getTypeMap();
    const result = [getSchemaDefinition(schema)];
    for (const typeName in typesMap) {
        const type = typesMap[typeName];
        const isPredefinedScalar = isScalarType(type) && isSpecifiedScalarType(type);
        const isIntrospection = isIntrospectionType(type);
        if (isPredefinedScalar || isIntrospection) {
            continue;
        }
        // KAMIL: we might want to turn on descriptions in future
        result.push(print((_a = correctType(typeName, typesMap)) === null || _a === void 0 ? void 0 : _a.astNode));
    }
    const directives = schema.getDirectives();
    for (const directive of directives) {
        if (directive.astNode) {
            result.push(print(directive.astNode));
        }
    }
    return result.join('\n');
}
function extendDefinition(type) {
    switch (type.astNode.kind) {
        case Kind.OBJECT_TYPE_DEFINITION:
            return {
                ...type.astNode,
                fields: type.astNode.fields.concat(type.extensionASTNodes.reduce((fields, node) => fields.concat(node.fields), [])),
            };
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
            return {
                ...type.astNode,
                fields: type.astNode.fields.concat(type.extensionASTNodes.reduce((fields, node) => fields.concat(node.fields), [])),
            };
        default:
            return type.astNode;
    }
}
function correctType(typeName, typesMap) {
    var _a;
    const type = typesMap[typeName];
    type.name = typeName.toString();
    if (type.astNode && type.extensionASTNodes) {
        type.astNode = type.extensionASTNodes ? extendDefinition(type) : type.astNode;
    }
    const doc = parse(printType(type));
    const fixedAstNode = doc.definitions[0];
    const originalAstNode = type === null || type === void 0 ? void 0 : type.astNode;
    if (originalAstNode) {
        fixedAstNode.directives = originalAstNode === null || originalAstNode === void 0 ? void 0 : originalAstNode.directives;
        if (fixedAstNode && 'fields' in fixedAstNode && originalAstNode && 'fields' in originalAstNode) {
            for (const fieldDefinitionNode of fixedAstNode.fields) {
                const originalFieldDefinitionNode = originalAstNode.fields.find(field => field.name.value === fieldDefinitionNode.name.value);
                fieldDefinitionNode.directives = originalFieldDefinitionNode === null || originalFieldDefinitionNode === void 0 ? void 0 : originalFieldDefinitionNode.directives;
                if (fieldDefinitionNode &&
                    'arguments' in fieldDefinitionNode &&
                    originalFieldDefinitionNode &&
                    'arguments' in originalFieldDefinitionNode) {
                    for (const argument of fieldDefinitionNode.arguments) {
                        const originalArgumentNode = (_a = originalFieldDefinitionNode.arguments) === null || _a === void 0 ? void 0 : _a.find(arg => arg.name.value === argument.name.value);
                        argument.directives = originalArgumentNode.directives;
                    }
                }
            }
        }
        else if (fixedAstNode && 'values' in fixedAstNode && originalAstNode && 'values' in originalAstNode) {
            for (const valueDefinitionNode of fixedAstNode.values) {
                const originalValueDefinitionNode = originalAstNode.values.find(valueNode => valueNode.name.value === valueDefinitionNode.name.value);
                valueDefinitionNode.directives = originalValueDefinitionNode === null || originalValueDefinitionNode === void 0 ? void 0 : originalValueDefinitionNode.directives;
            }
        }
    }
    type.astNode = fixedAstNode;
    return type;
}
function getSchemaDefinition(schema) {
    if (!Object.getOwnPropertyDescriptor(schema, 'astNode').get && schema.astNode) {
        return print(schema.astNode);
    }
    else {
        return createSchemaDefinition({
            query: schema.getQueryType(),
            mutation: schema.getMutationType(),
            subscription: schema.getSubscriptionType(),
        });
    }
}
//# sourceMappingURL=print-schema-with-directives.js.map