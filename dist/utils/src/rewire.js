import { GraphQLDirective, GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLObjectType, GraphQLNonNull, GraphQLScalarType, GraphQLUnionType, isInterfaceType, isEnumType, isInputObjectType, isListType, isNamedType, isNonNullType, isObjectType, isScalarType, isUnionType, isSpecifiedScalarType, } from 'graphql';
import { getBuiltInForStub, isNamedStub } from './stub';
export function rewireTypes(originalTypeMap, directives, options = {
    skipPruning: false,
}) {
    const newTypeMap = Object.create(null);
    Object.keys(originalTypeMap).forEach(typeName => {
        const namedType = originalTypeMap[typeName];
        if (namedType == null || typeName.startsWith('__')) {
            return;
        }
        const newName = namedType.name;
        if (newName.startsWith('__')) {
            return;
        }
        if (newTypeMap[newName] != null) {
            throw new Error(`Duplicate schema type name ${newName}`);
        }
        newTypeMap[newName] = namedType;
    });
    Object.keys(newTypeMap).forEach(typeName => {
        newTypeMap[typeName] = rewireNamedType(newTypeMap[typeName]);
    });
    const newDirectives = directives.map(directive => rewireDirective(directive));
    return options.skipPruning
        ? {
            typeMap: newTypeMap,
            directives: newDirectives,
        }
        : pruneTypes(newTypeMap, newDirectives);
    function rewireDirective(directive) {
        const directiveConfig = directive.toConfig();
        directiveConfig.args = rewireArgs(directiveConfig.args);
        return new GraphQLDirective(directiveConfig);
    }
    function rewireArgs(args) {
        const rewiredArgs = {};
        Object.keys(args).forEach(argName => {
            const arg = args[argName];
            const rewiredArgType = rewireType(arg.type);
            if (rewiredArgType != null) {
                arg.type = rewiredArgType;
                rewiredArgs[argName] = arg;
            }
        });
        return rewiredArgs;
    }
    function rewireNamedType(type) {
        if (isObjectType(type)) {
            const config = type.toConfig();
            const newConfig = {
                ...config,
                fields: () => rewireFields(config.fields),
                interfaces: () => rewireNamedTypes(config.interfaces),
            };
            return new GraphQLObjectType(newConfig);
        }
        else if (isInterfaceType(type)) {
            const config = type.toConfig();
            const newConfig = {
                ...config,
                fields: () => rewireFields(config.fields),
            };
            if ('interfaces' in newConfig) {
                newConfig.interfaces = () => rewireNamedTypes(config.interfaces);
            }
            return new GraphQLInterfaceType(newConfig);
        }
        else if (isUnionType(type)) {
            const config = type.toConfig();
            const newConfig = {
                ...config,
                types: () => rewireNamedTypes(config.types),
            };
            return new GraphQLUnionType(newConfig);
        }
        else if (isInputObjectType(type)) {
            const config = type.toConfig();
            const newConfig = {
                ...config,
                fields: () => rewireInputFields(config.fields),
            };
            return new GraphQLInputObjectType(newConfig);
        }
        else if (isEnumType(type)) {
            const enumConfig = type.toConfig();
            return new GraphQLEnumType(enumConfig);
        }
        else if (isScalarType(type)) {
            if (isSpecifiedScalarType(type)) {
                return type;
            }
            const scalarConfig = type.toConfig();
            return new GraphQLScalarType(scalarConfig);
        }
        throw new Error(`Unexpected schema type: ${type}`);
    }
    function rewireFields(fields) {
        const rewiredFields = {};
        Object.keys(fields).forEach(fieldName => {
            const field = fields[fieldName];
            const rewiredFieldType = rewireType(field.type);
            if (rewiredFieldType != null) {
                field.type = rewiredFieldType;
                field.args = rewireArgs(field.args);
                rewiredFields[fieldName] = field;
            }
        });
        return rewiredFields;
    }
    function rewireInputFields(fields) {
        const rewiredFields = {};
        Object.keys(fields).forEach(fieldName => {
            const field = fields[fieldName];
            const rewiredFieldType = rewireType(field.type);
            if (rewiredFieldType != null) {
                field.type = rewiredFieldType;
                rewiredFields[fieldName] = field;
            }
        });
        return rewiredFields;
    }
    function rewireNamedTypes(namedTypes) {
        const rewiredTypes = [];
        namedTypes.forEach(namedType => {
            const rewiredType = rewireType(namedType);
            if (rewiredType != null) {
                rewiredTypes.push(rewiredType);
            }
        });
        return rewiredTypes;
    }
    function rewireType(type) {
        if (isListType(type)) {
            const rewiredType = rewireType(type.ofType);
            return rewiredType != null ? new GraphQLList(rewiredType) : null;
        }
        else if (isNonNullType(type)) {
            const rewiredType = rewireType(type.ofType);
            return rewiredType != null ? new GraphQLNonNull(rewiredType) : null;
        }
        else if (isNamedType(type)) {
            let rewiredType = originalTypeMap[type.name];
            if (rewiredType === undefined) {
                rewiredType = isNamedStub(type) ? getBuiltInForStub(type) : type;
                newTypeMap[rewiredType.name] = rewiredType;
            }
            return rewiredType != null ? newTypeMap[rewiredType.name] : null;
        }
        return null;
    }
}
function pruneTypes(typeMap, directives) {
    const newTypeMap = {};
    const implementedInterfaces = {};
    Object.keys(typeMap).forEach(typeName => {
        const namedType = typeMap[typeName];
        if ('getInterfaces' in namedType) {
            namedType.getInterfaces().forEach(iface => {
                implementedInterfaces[iface.name] = true;
            });
        }
    });
    let prunedTypeMap = false;
    const typeNames = Object.keys(typeMap);
    for (let i = 0; i < typeNames.length; i++) {
        const typeName = typeNames[i];
        const type = typeMap[typeName];
        if (isObjectType(type) || isInputObjectType(type)) {
            // prune types with no fields
            if (Object.keys(type.getFields()).length) {
                newTypeMap[typeName] = type;
            }
            else {
                prunedTypeMap = true;
            }
        }
        else if (isUnionType(type)) {
            // prune unions without underlying types
            if (type.getTypes().length) {
                newTypeMap[typeName] = type;
            }
            else {
                prunedTypeMap = true;
            }
        }
        else if (isInterfaceType(type)) {
            // prune interfaces without fields or without implementations
            if (Object.keys(type.getFields()).length && implementedInterfaces[type.name]) {
                newTypeMap[typeName] = type;
            }
            else {
                prunedTypeMap = true;
            }
        }
        else {
            newTypeMap[typeName] = type;
        }
    }
    // every prune requires another round of healing
    return prunedTypeMap ? rewireTypes(newTypeMap, directives) : { typeMap, directives };
}
//# sourceMappingURL=rewire.js.map