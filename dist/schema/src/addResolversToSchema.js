import { GraphQLEnumType, isSchema, GraphQLScalarType, GraphQLUnionType, GraphQLInterfaceType, GraphQLObjectType, isSpecifiedScalarType, isScalarType, isEnumType, isUnionType, isInterfaceType, isObjectType, } from 'graphql';
import { mapSchema, MapperKind, forEachDefaultValue, serializeInputValue, healSchema, parseInputValue, forEachField, } from '@graphql-tools/utils';
import { checkForResolveTypeResolver } from './checkForResolveTypeResolver';
import { extendResolversFromInterfaces } from './extendResolversFromInterfaces';
export function addResolversToSchema(schemaOrOptions, legacyInputResolvers, legacyInputValidationOptions) {
    const options = isSchema(schemaOrOptions)
        ? {
            schema: schemaOrOptions,
            resolvers: legacyInputResolvers,
            resolverValidationOptions: legacyInputValidationOptions,
        }
        : schemaOrOptions;
    let { schema, resolvers: inputResolvers, defaultFieldResolver, resolverValidationOptions = {}, inheritResolversFromInterfaces = false, updateResolversInPlace = false, } = options;
    const { allowResolversNotInSchema = false, requireResolversForResolveType } = resolverValidationOptions;
    const resolvers = inheritResolversFromInterfaces
        ? extendResolversFromInterfaces(schema, inputResolvers)
        : inputResolvers;
    Object.keys(resolvers).forEach(typeName => {
        const resolverValue = resolvers[typeName];
        const resolverType = typeof resolverValue;
        if (typeName === '__schema') {
            if (resolverType !== 'function') {
                throw new Error(`"${typeName}" defined in resolvers, but has invalid value "${resolverValue}". A schema resolver's value must be of type object or function.`);
            }
        }
        else {
            if (resolverType !== 'object') {
                throw new Error(`"${typeName}" defined in resolvers, but has invalid value "${resolverValue}". The resolver's value must be of type object.`);
            }
            const type = schema.getType(typeName);
            if (type == null) {
                if (allowResolversNotInSchema) {
                    return;
                }
                throw new Error(`"${typeName}" defined in resolvers, but not in schema`);
            }
            else if (isSpecifiedScalarType(type)) {
                // allow -- without recommending -- overriding of specified scalar types
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        type[fieldName.substring(2)] = resolverValue[fieldName];
                    }
                    else {
                        type[fieldName] = resolverValue[fieldName];
                    }
                });
            }
        }
    });
    schema = updateResolversInPlace
        ? addResolversToExistingSchema({
            schema,
            resolvers,
            defaultFieldResolver,
            allowResolversNotInSchema,
        })
        : createNewSchemaWithResolvers({
            schema,
            resolvers,
            defaultFieldResolver,
            allowResolversNotInSchema,
        });
    checkForResolveTypeResolver(schema, requireResolversForResolveType);
    return schema;
}
function addResolversToExistingSchema({ schema, resolvers, defaultFieldResolver, allowResolversNotInSchema, }) {
    const typeMap = schema.getTypeMap();
    Object.keys(resolvers).forEach(typeName => {
        if (typeName !== '__schema') {
            const type = schema.getType(typeName);
            const resolverValue = resolvers[typeName];
            if (isScalarType(type)) {
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        type[fieldName.substring(2)] = resolverValue[fieldName];
                    }
                    else {
                        type[fieldName] = resolverValue[fieldName];
                    }
                });
            }
            else if (isEnumType(type)) {
                const config = type.toConfig();
                const enumValueConfigMap = config.values;
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        config[fieldName.substring(2)] = resolverValue[fieldName];
                    }
                    else if (!enumValueConfigMap[fieldName]) {
                        if (allowResolversNotInSchema) {
                            return;
                        }
                        throw new Error(`${type.name}.${fieldName} was defined in resolvers, but not present within ${type.name}`);
                    }
                    else {
                        enumValueConfigMap[fieldName].value = resolverValue[fieldName];
                    }
                });
                typeMap[typeName] = new GraphQLEnumType(config);
            }
            else if (isUnionType(type)) {
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        type[fieldName.substring(2)] = resolverValue[fieldName];
                        return;
                    }
                    if (allowResolversNotInSchema) {
                        return;
                    }
                    throw new Error(`${type.name}.${fieldName} was defined in resolvers, but ${type.name} is not an object or interface type`);
                });
            }
            else if (isObjectType(type) || isInterfaceType(type)) {
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        // this is for isTypeOf and resolveType and all the other stuff.
                        type[fieldName.substring(2)] = resolverValue[fieldName];
                        return;
                    }
                    const fields = type.getFields();
                    const field = fields[fieldName];
                    if (field == null) {
                        if (allowResolversNotInSchema) {
                            return;
                        }
                        throw new Error(`${typeName}.${fieldName} defined in resolvers, but not in schema`);
                    }
                    const fieldResolve = resolverValue[fieldName];
                    if (typeof fieldResolve === 'function') {
                        // for convenience. Allows shorter syntax in resolver definition file
                        field.resolve = fieldResolve;
                    }
                    else {
                        if (typeof fieldResolve !== 'object') {
                            throw new Error(`Resolver ${typeName}.${fieldName} must be object or function`);
                        }
                        setFieldProperties(field, fieldResolve);
                    }
                });
            }
        }
    });
    // serialize all default values prior to healing fields with new scalar/enum types.
    forEachDefaultValue(schema, serializeInputValue);
    // schema may have new scalar/enum types that require healing
    healSchema(schema);
    // reparse all default values with new parsing functions.
    forEachDefaultValue(schema, parseInputValue);
    if (defaultFieldResolver != null) {
        forEachField(schema, field => {
            if (!field.resolve) {
                field.resolve = defaultFieldResolver;
            }
        });
    }
    return schema;
}
function createNewSchemaWithResolvers({ schema, resolvers, defaultFieldResolver, allowResolversNotInSchema, }) {
    schema = mapSchema(schema, {
        [MapperKind.SCALAR_TYPE]: type => {
            const config = type.toConfig();
            const resolverValue = resolvers[type.name];
            if (!isSpecifiedScalarType(type) && resolverValue != null) {
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        config[fieldName.substring(2)] = resolverValue[fieldName];
                    }
                    else {
                        config[fieldName] = resolverValue[fieldName];
                    }
                });
                return new GraphQLScalarType(config);
            }
        },
        [MapperKind.ENUM_TYPE]: type => {
            const resolverValue = resolvers[type.name];
            const config = type.toConfig();
            const enumValueConfigMap = config.values;
            if (resolverValue != null) {
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        config[fieldName.substring(2)] = resolverValue[fieldName];
                    }
                    else if (!enumValueConfigMap[fieldName]) {
                        if (allowResolversNotInSchema) {
                            return;
                        }
                        throw new Error(`${type.name}.${fieldName} was defined in resolvers, but not present within ${type.name}`);
                    }
                    else {
                        enumValueConfigMap[fieldName].value = resolverValue[fieldName];
                    }
                });
                return new GraphQLEnumType(config);
            }
        },
        [MapperKind.UNION_TYPE]: type => {
            const resolverValue = resolvers[type.name];
            if (resolverValue != null) {
                const config = type.toConfig();
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        // this is for isTypeOf and resolveType and all the other stuff.
                        config[fieldName.substring(2)] = resolverValue[fieldName];
                        return;
                    }
                    if (allowResolversNotInSchema) {
                        return;
                    }
                    throw new Error(`${type.name}.${fieldName} was defined in resolvers, but ${type.name} is not an object or interface type`);
                });
                return new GraphQLUnionType(config);
            }
        },
        [MapperKind.OBJECT_TYPE]: type => {
            const resolverValue = resolvers[type.name];
            if (resolverValue != null) {
                const config = type.toConfig();
                const fields = config.fields;
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        config[fieldName.substring(2)] = resolverValue[fieldName];
                        return;
                    }
                    const field = fields[fieldName];
                    if (field == null) {
                        if (allowResolversNotInSchema) {
                            return;
                        }
                        throw new Error(`${type.name}.${fieldName} defined in resolvers, but not in schema`);
                    }
                });
                return new GraphQLObjectType(config);
            }
        },
        [MapperKind.INTERFACE_TYPE]: type => {
            const resolverValue = resolvers[type.name];
            if (resolverValue != null) {
                const config = type.toConfig();
                const fields = config.fields;
                Object.keys(resolverValue).forEach(fieldName => {
                    if (fieldName.startsWith('__')) {
                        config[fieldName.substring(2)] = resolverValue[fieldName];
                        return;
                    }
                    const field = fields[fieldName];
                    if (field == null) {
                        if (allowResolversNotInSchema) {
                            return;
                        }
                        throw new Error(`${type.name}.${fieldName} defined in resolvers, but not in schema`);
                    }
                });
                return new GraphQLInterfaceType(config);
            }
        },
        [MapperKind.COMPOSITE_FIELD]: (fieldConfig, fieldName, typeName) => {
            const resolverValue = resolvers[typeName];
            if (resolverValue != null) {
                const fieldResolve = resolverValue[fieldName];
                if (fieldResolve != null) {
                    const newFieldConfig = { ...fieldConfig };
                    if (typeof fieldResolve === 'function') {
                        // for convenience. Allows shorter syntax in resolver definition file
                        newFieldConfig.resolve = fieldResolve;
                    }
                    else {
                        if (typeof fieldResolve !== 'object') {
                            throw new Error(`Resolver ${typeName}.${fieldName} must be object or function`);
                        }
                        setFieldProperties(newFieldConfig, fieldResolve);
                    }
                    return newFieldConfig;
                }
            }
        },
    });
    if (defaultFieldResolver != null) {
        schema = mapSchema(schema, {
            [MapperKind.OBJECT_FIELD]: fieldConfig => ({
                ...fieldConfig,
                resolve: fieldConfig.resolve != null ? fieldConfig.resolve : defaultFieldResolver,
            }),
        });
    }
    return schema;
}
function setFieldProperties(field, propertiesObj) {
    Object.keys(propertiesObj).forEach(propertyName => {
        field[propertyName] = propertiesObj[propertyName];
    });
}
//# sourceMappingURL=addResolversToSchema.js.map