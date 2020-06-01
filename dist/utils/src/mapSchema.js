import { GraphQLObjectType, GraphQLSchema, isInterfaceType, isEnumType, isObjectType, isScalarType, isUnionType, isInputObjectType, GraphQLInputObjectType, GraphQLInterfaceType, isLeafType, isListType, isNonNullType, isNamedType, GraphQLList, GraphQLNonNull, GraphQLEnumType, } from 'graphql';
import { MapperKind, } from './Interfaces';
import { rewireTypes } from './rewire';
import { serializeInputValue, parseInputValue } from './transformInputValue';
export function mapSchema(schema, schemaMapper = {}) {
    const originalTypeMap = schema.getTypeMap();
    let newTypeMap = mapDefaultValues(originalTypeMap, schema, serializeInputValue);
    newTypeMap = mapTypes(newTypeMap, schema, schemaMapper, type => isLeafType(type));
    newTypeMap = mapEnumValues(newTypeMap, schema, schemaMapper);
    newTypeMap = mapDefaultValues(newTypeMap, schema, parseInputValue);
    newTypeMap = mapTypes(newTypeMap, schema, schemaMapper, type => !isLeafType(type));
    newTypeMap = mapFields(newTypeMap, schema, schemaMapper);
    newTypeMap = mapArguments(newTypeMap, schema, schemaMapper);
    const originalDirectives = schema.getDirectives();
    const newDirectives = mapDirectives(originalDirectives, schema, schemaMapper);
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();
    const newQueryTypeName = queryType != null ? (newTypeMap[queryType.name] != null ? newTypeMap[queryType.name].name : undefined) : undefined;
    const newMutationTypeName = mutationType != null
        ? newTypeMap[mutationType.name] != null
            ? newTypeMap[mutationType.name].name
            : undefined
        : undefined;
    const newSubscriptionTypeName = subscriptionType != null
        ? newTypeMap[subscriptionType.name] != null
            ? newTypeMap[subscriptionType.name].name
            : undefined
        : undefined;
    const { typeMap, directives } = rewireTypes(newTypeMap, newDirectives);
    return new GraphQLSchema({
        ...schema.toConfig(),
        query: newQueryTypeName ? typeMap[newQueryTypeName] : undefined,
        mutation: newMutationTypeName ? typeMap[newMutationTypeName] : undefined,
        subscription: newSubscriptionTypeName != null ? typeMap[newSubscriptionTypeName] : undefined,
        types: Object.keys(typeMap).map(typeName => typeMap[typeName]),
        directives,
    });
}
function mapTypes(originalTypeMap, schema, schemaMapper, testFn = () => true) {
    const newTypeMap = {};
    Object.keys(originalTypeMap).forEach(typeName => {
        if (!typeName.startsWith('__')) {
            const originalType = originalTypeMap[typeName];
            if (originalType == null || !testFn(originalType)) {
                newTypeMap[typeName] = originalType;
                return;
            }
            const typeMapper = getTypeMapper(schema, schemaMapper, typeName);
            if (typeMapper == null) {
                newTypeMap[typeName] = originalType;
                return;
            }
            const maybeNewType = typeMapper(originalType, schema);
            if (maybeNewType === undefined) {
                newTypeMap[typeName] = originalType;
                return;
            }
            newTypeMap[typeName] = maybeNewType;
        }
    });
    return newTypeMap;
}
function mapEnumValues(originalTypeMap, schema, schemaMapper) {
    const enumValueMapper = getEnumValueMapper(schemaMapper);
    if (!enumValueMapper) {
        return originalTypeMap;
    }
    return mapTypes(originalTypeMap, schema, {
        [MapperKind.ENUM_TYPE]: type => {
            const config = type.toConfig();
            const originalEnumValueConfigMap = config.values;
            const newEnumValueConfigMap = {};
            Object.keys(originalEnumValueConfigMap).forEach(enumValueName => {
                const originalEnumValueConfig = originalEnumValueConfigMap[enumValueName];
                const mappedEnumValue = enumValueMapper(originalEnumValueConfig, type.name, schema);
                if (mappedEnumValue === undefined) {
                    newEnumValueConfigMap[enumValueName] = originalEnumValueConfig;
                }
                else if (Array.isArray(mappedEnumValue)) {
                    const [newEnumValueName, newEnumValueConfig] = mappedEnumValue;
                    newEnumValueConfigMap[newEnumValueName] = newEnumValueConfig;
                }
                else if (mappedEnumValue !== null) {
                    newEnumValueConfigMap[enumValueName] = mappedEnumValue;
                }
            });
            return new GraphQLEnumType({
                ...config,
                values: newEnumValueConfigMap,
            });
        },
    }, type => isEnumType(type));
}
function mapDefaultValues(originalTypeMap, schema, fn) {
    const newTypeMap = mapArguments(originalTypeMap, schema, {
        [MapperKind.ARGUMENT]: argumentConfig => {
            if (argumentConfig.defaultValue === undefined) {
                return argumentConfig;
            }
            const maybeNewType = getNewType(originalTypeMap, argumentConfig.type);
            if (maybeNewType != null) {
                return {
                    ...argumentConfig,
                    defaultValue: fn(maybeNewType, argumentConfig.defaultValue),
                };
            }
        },
    });
    return mapFields(newTypeMap, schema, {
        [MapperKind.INPUT_OBJECT_FIELD]: inputFieldConfig => {
            if (inputFieldConfig.defaultValue === undefined) {
                return inputFieldConfig;
            }
            const maybeNewType = getNewType(newTypeMap, inputFieldConfig.type);
            if (maybeNewType != null) {
                return {
                    ...inputFieldConfig,
                    defaultValue: fn(maybeNewType, inputFieldConfig.defaultValue),
                };
            }
        },
    });
}
function getNewType(newTypeMap, type) {
    if (isListType(type)) {
        const newType = getNewType(newTypeMap, type.ofType);
        return newType != null ? new GraphQLList(newType) : null;
    }
    else if (isNonNullType(type)) {
        const newType = getNewType(newTypeMap, type.ofType);
        return newType != null ? new GraphQLNonNull(newType) : null;
    }
    else if (isNamedType(type)) {
        const newType = newTypeMap[type.name];
        return newType != null ? newType : null;
    }
    return null;
}
function mapFields(originalTypeMap, schema, schemaMapper) {
    const newTypeMap = {};
    Object.keys(originalTypeMap).forEach(typeName => {
        if (!typeName.startsWith('__')) {
            const originalType = originalTypeMap[typeName];
            if (!isObjectType(originalType) && !isInterfaceType(originalType) && !isInputObjectType(originalType)) {
                newTypeMap[typeName] = originalType;
                return;
            }
            const fieldMapper = getFieldMapper(schema, schemaMapper, typeName);
            if (fieldMapper == null) {
                newTypeMap[typeName] = originalType;
                return;
            }
            const config = originalType.toConfig();
            const originalFieldConfigMap = config.fields;
            const newFieldConfigMap = {};
            Object.keys(originalFieldConfigMap).forEach(fieldName => {
                const originalFieldConfig = originalFieldConfigMap[fieldName];
                const mappedField = fieldMapper(originalFieldConfig, fieldName, typeName, schema);
                if (mappedField === undefined) {
                    newFieldConfigMap[fieldName] = originalFieldConfig;
                }
                else if (Array.isArray(mappedField)) {
                    const [newFieldName, newFieldConfig] = mappedField;
                    newFieldConfigMap[newFieldName] = newFieldConfig;
                }
                else if (mappedField !== null) {
                    newFieldConfigMap[fieldName] = mappedField;
                }
            });
            if (isObjectType(originalType)) {
                newTypeMap[typeName] = new GraphQLObjectType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
            else if (isInterfaceType(originalType)) {
                newTypeMap[typeName] = new GraphQLInterfaceType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
            else {
                newTypeMap[typeName] = new GraphQLInputObjectType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
        }
    });
    return newTypeMap;
}
function mapArguments(originalTypeMap, schema, schemaMapper) {
    const newTypeMap = {};
    Object.keys(originalTypeMap).forEach(typeName => {
        if (!typeName.startsWith('__')) {
            const originalType = originalTypeMap[typeName];
            if (!isObjectType(originalType) && !isInterfaceType(originalType)) {
                newTypeMap[typeName] = originalType;
                return;
            }
            const argumentMapper = getArgumentMapper(schemaMapper);
            if (argumentMapper == null) {
                newTypeMap[typeName] = originalType;
                return;
            }
            const config = originalType.toConfig();
            const originalFieldConfigMap = config.fields;
            const newFieldConfigMap = {};
            Object.keys(originalFieldConfigMap).forEach(fieldName => {
                const originalFieldConfig = originalFieldConfigMap[fieldName];
                const originalArgumentConfigMap = originalFieldConfig.args;
                if (originalArgumentConfigMap == null) {
                    newFieldConfigMap[fieldName] = originalFieldConfig;
                    return;
                }
                const argumentNames = Object.keys(originalArgumentConfigMap);
                if (!argumentNames.length) {
                    newFieldConfigMap[fieldName] = originalFieldConfig;
                    return;
                }
                const newArgumentConfigMap = {};
                argumentNames.forEach(argumentName => {
                    const originalArgumentConfig = originalArgumentConfigMap[argumentName];
                    const mappedArgument = argumentMapper(originalArgumentConfig, fieldName, typeName, schema);
                    if (mappedArgument === undefined) {
                        newArgumentConfigMap[argumentName] = originalArgumentConfig;
                    }
                    else if (Array.isArray(mappedArgument)) {
                        const [newArgumentName, newArgumentConfig] = mappedArgument;
                        newArgumentConfigMap[newArgumentName] = newArgumentConfig;
                    }
                    else if (mappedArgument !== null) {
                        newArgumentConfigMap[argumentName] = mappedArgument;
                    }
                });
                newFieldConfigMap[fieldName] = {
                    ...originalFieldConfig,
                    args: newArgumentConfigMap,
                };
            });
            if (isObjectType(originalType)) {
                newTypeMap[typeName] = new GraphQLObjectType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
            else if (isInterfaceType(originalType)) {
                newTypeMap[typeName] = new GraphQLInterfaceType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
            else {
                newTypeMap[typeName] = new GraphQLInputObjectType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
        }
    });
    return newTypeMap;
}
function mapDirectives(originalDirectives, schema, schemaMapper) {
    const directiveMapper = getDirectiveMapper(schemaMapper);
    if (directiveMapper == null) {
        return originalDirectives.slice();
    }
    const newDirectives = [];
    originalDirectives.forEach(directive => {
        const mappedDirective = directiveMapper(directive, schema);
        if (mappedDirective === undefined) {
            newDirectives.push(directive);
        }
        else if (mappedDirective !== null) {
            newDirectives.push(mappedDirective);
        }
    });
    return newDirectives;
}
function getTypeSpecifiers(schema, typeName) {
    const type = schema.getType(typeName);
    const specifiers = [MapperKind.TYPE];
    if (isObjectType(type)) {
        specifiers.push(MapperKind.COMPOSITE_TYPE, MapperKind.OBJECT_TYPE);
        const query = schema.getQueryType();
        const mutation = schema.getMutationType();
        const subscription = schema.getSubscriptionType();
        if (query != null && typeName === query.name) {
            specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.QUERY);
        }
        else if (mutation != null && typeName === mutation.name) {
            specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.MUTATION);
        }
        else if (subscription != null && typeName === subscription.name) {
            specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.SUBSCRIPTION);
        }
    }
    else if (isInputObjectType(type)) {
        specifiers.push(MapperKind.INPUT_OBJECT_TYPE);
    }
    else if (isInterfaceType(type)) {
        specifiers.push(MapperKind.COMPOSITE_TYPE, MapperKind.ABSTRACT_TYPE, MapperKind.INTERFACE_TYPE);
    }
    else if (isUnionType(type)) {
        specifiers.push(MapperKind.COMPOSITE_TYPE, MapperKind.ABSTRACT_TYPE, MapperKind.UNION_TYPE);
    }
    else if (isEnumType(type)) {
        specifiers.push(MapperKind.ENUM_TYPE);
    }
    else if (isScalarType(type)) {
        specifiers.push(MapperKind.SCALAR_TYPE);
    }
    return specifiers;
}
function getTypeMapper(schema, schemaMapper, typeName) {
    const specifiers = getTypeSpecifiers(schema, typeName);
    let typeMapper;
    const stack = [...specifiers];
    while (!typeMapper && stack.length > 0) {
        const next = stack.pop();
        typeMapper = schemaMapper[next];
    }
    return typeMapper != null ? typeMapper : null;
}
function getFieldSpecifiers(schema, typeName) {
    const type = schema.getType(typeName);
    const specifiers = [MapperKind.FIELD];
    if (isObjectType(type)) {
        specifiers.push(MapperKind.COMPOSITE_FIELD, MapperKind.OBJECT_FIELD);
        const query = schema.getQueryType();
        const mutation = schema.getMutationType();
        const subscription = schema.getSubscriptionType();
        if (query != null && typeName === query.name) {
            specifiers.push(MapperKind.ROOT_FIELD, MapperKind.QUERY_ROOT_FIELD);
        }
        else if (mutation != null && typeName === mutation.name) {
            specifiers.push(MapperKind.ROOT_FIELD, MapperKind.MUTATION_ROOT_FIELD);
        }
        else if (subscription != null && typeName === subscription.name) {
            specifiers.push(MapperKind.ROOT_FIELD, MapperKind.SUBSCRIPTION_ROOT_FIELD);
        }
    }
    else if (isInterfaceType(type)) {
        specifiers.push(MapperKind.COMPOSITE_FIELD, MapperKind.INTERFACE_FIELD);
    }
    else if (isInputObjectType(type)) {
        specifiers.push(MapperKind.INPUT_OBJECT_FIELD);
    }
    return specifiers;
}
function getFieldMapper(schema, schemaMapper, typeName) {
    const specifiers = getFieldSpecifiers(schema, typeName);
    let fieldMapper;
    const stack = [...specifiers];
    while (!fieldMapper && stack.length > 0) {
        const next = stack.pop();
        fieldMapper = schemaMapper[next];
    }
    return fieldMapper != null ? fieldMapper : null;
}
function getArgumentMapper(schemaMapper) {
    const argumentMapper = schemaMapper[MapperKind.ARGUMENT];
    return argumentMapper != null ? argumentMapper : null;
}
function getDirectiveMapper(schemaMapper) {
    const directiveMapper = schemaMapper[MapperKind.DIRECTIVE];
    return directiveMapper != null ? directiveMapper : null;
}
function getEnumValueMapper(schemaMapper) {
    const enumValueMapper = schemaMapper[MapperKind.ENUM_VALUE];
    return enumValueMapper != null ? enumValueMapper : null;
}
//# sourceMappingURL=mapSchema.js.map