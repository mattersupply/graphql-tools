import { GraphQLObjectType, GraphQLInterfaceType, GraphQLUnionType, isSpecifiedScalarType, isScalarType, isObjectType, isInterfaceType, isUnionType, isInputObjectType, GraphQLInputObjectType, isEnumType, GraphQLEnumType, GraphQLScalarType, visit, Kind, TypeInfo, visitWithTypeInfo, extendSchema, parse, getNullableType, BREAK, buildSchema, getIntrospectionQuery, buildClientSchema } from 'graphql';
import { applySchemaTransforms, getResponseKeyFromInfo, getErrors, mapSchema, MapperKind, relocatedError, hoistFieldNodes, selectObjectFields, appendObjectFields, modifyObjectFields, wrapFieldNode, renameFieldNode, removeObjectFields, CombinedError } from '@graphql-tools/utils';
import { isSubschemaConfig, delegateToSchema, getSubschema, handleResult, defaultMergedResolver, createMergedResolver } from '@graphql-tools/delegate';
import { addResolversToSchema } from '@graphql-tools/schema';

function generateProxyingResolvers(subschemaOrSubschemaConfig, transforms) {
    var _a;
    let targetSchema;
    let schemaTransforms = [];
    let createProxyingResolver;
    if (isSubschemaConfig(subschemaOrSubschemaConfig)) {
        targetSchema = subschemaOrSubschemaConfig.schema;
        createProxyingResolver = (_a = subschemaOrSubschemaConfig.createProxyingResolver) !== null && _a !== void 0 ? _a : defaultCreateProxyingResolver;
        if (subschemaOrSubschemaConfig.transforms != null) {
            schemaTransforms = schemaTransforms.concat(subschemaOrSubschemaConfig.transforms);
        }
    }
    else {
        targetSchema = subschemaOrSubschemaConfig;
        createProxyingResolver = defaultCreateProxyingResolver;
    }
    if (transforms != null) {
        schemaTransforms = schemaTransforms.concat(transforms);
    }
    const transformedSchema = applySchemaTransforms(targetSchema, schemaTransforms);
    const operationTypes = {
        query: targetSchema.getQueryType(),
        mutation: targetSchema.getMutationType(),
        subscription: targetSchema.getSubscriptionType(),
    };
    const resolvers = {};
    Object.keys(operationTypes).forEach((operation) => {
        const rootType = operationTypes[operation];
        if (rootType != null) {
            const typeName = rootType.name;
            const fields = rootType.getFields();
            resolvers[typeName] = {};
            Object.keys(fields).forEach(fieldName => {
                const proxyingResolver = createProxyingResolver({
                    schema: subschemaOrSubschemaConfig,
                    transforms,
                    transformedSchema,
                    operation,
                    fieldName,
                });
                const finalResolver = createPossiblyNestedProxyingResolver(subschemaOrSubschemaConfig, proxyingResolver);
                if (operation === 'subscription') {
                    resolvers[typeName][fieldName] = {
                        subscribe: finalResolver,
                        resolve: (payload, _, __, { fieldName: targetFieldName }) => payload[targetFieldName],
                    };
                }
                else {
                    resolvers[typeName][fieldName] = {
                        resolve: finalResolver,
                    };
                }
            });
        }
    });
    return resolvers;
}
function createPossiblyNestedProxyingResolver(subschemaOrSubschemaConfig, proxyingResolver) {
    return (parent, args, context, info) => {
        if (parent != null) {
            const responseKey = getResponseKeyFromInfo(info);
            const errors = getErrors(parent, responseKey);
            // Check to see if the parent contains a proxied result
            if (errors != null) {
                const subschema = getSubschema(parent, responseKey);
                // If there is a proxied result from this subschema, return it
                // This can happen even for a root field when the root type ia
                // also nested as a field within a different type.
                if (subschemaOrSubschemaConfig === subschema && parent[responseKey] !== undefined) {
                    return handleResult(parent[responseKey], errors, subschema, context, info);
                }
            }
        }
        return proxyingResolver(parent, args, context, info);
    };
}
function defaultCreateProxyingResolver({ schema, transforms, transformedSchema, }) {
    return (_parent, _args, context, info) => delegateToSchema({
        schema,
        context,
        info,
        transforms,
        transformedSchema,
    });
}

function wrapSchema(subschemaOrSubschemaConfig, transforms) {
    let targetSchema;
    let schemaTransforms = [];
    if (isSubschemaConfig(subschemaOrSubschemaConfig)) {
        targetSchema = subschemaOrSubschemaConfig.schema;
        if (subschemaOrSubschemaConfig.transforms != null) {
            schemaTransforms = schemaTransforms.concat(subschemaOrSubschemaConfig.transforms);
        }
    }
    else {
        targetSchema = subschemaOrSubschemaConfig;
    }
    if (transforms != null) {
        schemaTransforms = schemaTransforms.concat(transforms);
    }
    const proxyingResolvers = generateProxyingResolvers(subschemaOrSubschemaConfig, transforms);
    const schema = createWrappingSchema(targetSchema, proxyingResolvers);
    return applySchemaTransforms(schema, schemaTransforms);
}
function createWrappingSchema(schema, proxyingResolvers) {
    return mapSchema(schema, {
        [MapperKind.ROOT_OBJECT]: type => {
            const config = type.toConfig();
            const fieldConfigMap = config.fields;
            Object.keys(fieldConfigMap).forEach(fieldName => {
                fieldConfigMap[fieldName] = {
                    ...fieldConfigMap[fieldName],
                    ...proxyingResolvers[type.name][fieldName],
                };
            });
            return new GraphQLObjectType(config);
        },
        [MapperKind.OBJECT_TYPE]: type => {
            const config = type.toConfig();
            config.isTypeOf = undefined;
            Object.keys(config.fields).forEach(fieldName => {
                config.fields[fieldName].resolve = defaultMergedResolver;
                config.fields[fieldName].subscribe = null;
            });
            return new GraphQLObjectType(config);
        },
        [MapperKind.INTERFACE_TYPE]: type => {
            const config = type.toConfig();
            delete config.resolveType;
            return new GraphQLInterfaceType(config);
        },
        [MapperKind.UNION_TYPE]: type => {
            const config = type.toConfig();
            delete config.resolveType;
            return new GraphQLUnionType(config);
        },
    });
}

class RenameTypes {
    constructor(renamer, options) {
        this.renamer = renamer;
        this.map = Object.create(null);
        this.reverseMap = Object.create(null);
        const { renameBuiltins = false, renameScalars = true } = options != null ? options : {};
        this.renameBuiltins = renameBuiltins;
        this.renameScalars = renameScalars;
    }
    transformSchema(originalSchema) {
        return mapSchema(originalSchema, {
            [MapperKind.TYPE]: (type) => {
                if (isSpecifiedScalarType(type) && !this.renameBuiltins) {
                    return undefined;
                }
                if (isScalarType(type) && !this.renameScalars) {
                    return undefined;
                }
                const oldName = type.name;
                const newName = this.renamer(oldName);
                if (newName !== undefined && newName !== oldName) {
                    this.map[oldName] = newName;
                    this.reverseMap[newName] = oldName;
                    if (isObjectType(type)) {
                        return new GraphQLObjectType({
                            ...type.toConfig(),
                            name: newName,
                        });
                    }
                    else if (isInterfaceType(type)) {
                        return new GraphQLInterfaceType({
                            ...type.toConfig(),
                            name: newName,
                        });
                    }
                    else if (isUnionType(type)) {
                        return new GraphQLUnionType({
                            ...type.toConfig(),
                            name: newName,
                        });
                    }
                    else if (isInputObjectType(type)) {
                        return new GraphQLInputObjectType({
                            ...type.toConfig(),
                            name: newName,
                        });
                    }
                    else if (isEnumType(type)) {
                        return new GraphQLEnumType({
                            ...type.toConfig(),
                            name: newName,
                        });
                    }
                    else if (isScalarType(type)) {
                        return new GraphQLScalarType({
                            ...type.toConfig(),
                            name: newName,
                        });
                    }
                    throw new Error(`Unknown type ${type}.`);
                }
            },
            [MapperKind.ROOT_OBJECT]() {
                return undefined;
            },
        });
    }
    transformRequest(originalRequest) {
        const newDocument = visit(originalRequest.document, {
            [Kind.NAMED_TYPE]: (node) => {
                const name = node.name.value;
                if (name in this.reverseMap) {
                    return {
                        ...node,
                        name: {
                            kind: Kind.NAME,
                            value: this.reverseMap[name],
                        },
                    };
                }
            },
        });
        return {
            document: newDocument,
            variables: originalRequest.variables,
        };
    }
    transformResult(result) {
        return {
            ...result,
            data: this.transformData(result.data),
        };
    }
    transformData(data) {
        if (data == null) {
            return data;
        }
        else if (Array.isArray(data)) {
            return data.map(value => this.transformData(value));
        }
        else if (typeof data === 'object') {
            return this.transformObject(data);
        }
        return data;
    }
    transformObject(object) {
        Object.keys(object).forEach(key => {
            const value = object[key];
            if (key === '__typename') {
                if (value in this.map) {
                    object[key] = this.map[value];
                }
            }
            else {
                object[key] = this.transformData(value);
            }
        });
        return object;
    }
}

class FilterTypes {
    constructor(filter) {
        this.filter = filter;
    }
    transformSchema(schema) {
        return mapSchema(schema, {
            [MapperKind.TYPE]: (type) => {
                if (this.filter(type)) {
                    return undefined;
                }
                return null;
            },
        });
    }
}

class RenameRootTypes {
    constructor(renamer) {
        this.renamer = renamer;
        this.map = Object.create(null);
        this.reverseMap = Object.create(null);
    }
    transformSchema(originalSchema) {
        return mapSchema(originalSchema, {
            [MapperKind.ROOT_OBJECT]: type => {
                const oldName = type.name;
                const newName = this.renamer(oldName);
                if (newName !== undefined && newName !== oldName) {
                    this.map[oldName] = newName;
                    this.reverseMap[newName] = oldName;
                    return new GraphQLObjectType({
                        ...type.toConfig(),
                        name: newName,
                    });
                }
            },
        });
    }
    transformRequest(originalRequest) {
        const newDocument = visit(originalRequest.document, {
            [Kind.NAMED_TYPE]: (node) => {
                const name = node.name.value;
                if (name in this.reverseMap) {
                    return {
                        ...node,
                        name: {
                            kind: Kind.NAME,
                            value: this.reverseMap[name],
                        },
                    };
                }
            },
        });
        return {
            document: newDocument,
            variables: originalRequest.variables,
        };
    }
    transformResult(result) {
        return {
            ...result,
            data: this.transformData(result.data),
        };
    }
    transformData(data) {
        if (data == null) {
            return data;
        }
        else if (Array.isArray(data)) {
            return data.map(value => this.transformData(value));
        }
        else if (typeof data === 'object') {
            return this.transformObject(data);
        }
        return data;
    }
    transformObject(object) {
        Object.keys(object).forEach(key => {
            const value = object[key];
            if (key === '__typename') {
                if (value in this.map) {
                    object[key] = this.map[value];
                }
            }
            else {
                object[key] = this.transformData(value);
            }
        });
        return object;
    }
}

class TransformCompositeFields {
    constructor(fieldTransformer, fieldNodeTransformer) {
        this.fieldTransformer = fieldTransformer;
        this.fieldNodeTransformer = fieldNodeTransformer;
        this.mapping = {};
    }
    transformSchema(originalSchema) {
        this.transformedSchema = mapSchema(originalSchema, {
            [MapperKind.OBJECT_TYPE]: (type) => this.transformFields(type, this.fieldTransformer),
            [MapperKind.INTERFACE_TYPE]: (type) => this.transformFields(type, this.fieldTransformer),
        });
        return this.transformedSchema;
    }
    transformRequest(originalRequest) {
        const fragments = Object.create(null);
        originalRequest.document.definitions
            .filter(def => def.kind === Kind.FRAGMENT_DEFINITION)
            .forEach(def => {
            fragments[def.name.value] = def;
        });
        const document = this.transformDocument(originalRequest.document, this.mapping, this.fieldNodeTransformer, fragments);
        return {
            ...originalRequest,
            document,
        };
    }
    transformFields(type, fieldTransformer) {
        const config = type.toConfig();
        const originalFieldConfigMap = config.fields;
        const newFieldConfigMap = {};
        Object.keys(originalFieldConfigMap).forEach(fieldName => {
            const originalfieldConfig = originalFieldConfigMap[fieldName];
            const transformedField = fieldTransformer(type.name, fieldName, originalfieldConfig);
            if (transformedField === undefined) {
                newFieldConfigMap[fieldName] = originalfieldConfig;
            }
            else if (Array.isArray(transformedField)) {
                const newFieldName = transformedField[0];
                const newFieldConfig = transformedField[1];
                newFieldConfigMap[newFieldName] = newFieldConfig;
                if (newFieldName !== fieldName) {
                    const typeName = type.name;
                    if (!(typeName in this.mapping)) {
                        this.mapping[typeName] = {};
                    }
                    this.mapping[typeName][newFieldName] = fieldName;
                }
            }
            else if (transformedField != null) {
                newFieldConfigMap[fieldName] = transformedField;
            }
        });
        if (!Object.keys(newFieldConfigMap).length) {
            return null;
        }
        if (isObjectType(type)) {
            return new GraphQLObjectType({
                ...type.toConfig(),
                fields: newFieldConfigMap,
            });
        }
        else if (isInterfaceType(type)) {
            return new GraphQLInterfaceType({
                ...type.toConfig(),
                fields: newFieldConfigMap,
            });
        }
    }
    transformDocument(document, mapping, fieldNodeTransformer, fragments = {}) {
        const typeInfo = new TypeInfo(this.transformedSchema);
        const newDocument = visit(document, visitWithTypeInfo(typeInfo, {
            leave: {
                [Kind.SELECTION_SET]: (node) => {
                    const parentType = typeInfo.getParentType();
                    if (parentType != null) {
                        const parentTypeName = parentType.name;
                        let newSelections = [];
                        node.selections.forEach(selection => {
                            if (selection.kind !== Kind.FIELD) {
                                newSelections.push(selection);
                                return;
                            }
                            const newName = selection.name.value;
                            const transformedSelection = fieldNodeTransformer != null
                                ? fieldNodeTransformer(parentTypeName, newName, selection, fragments)
                                : selection;
                            if (Array.isArray(transformedSelection)) {
                                newSelections = newSelections.concat(transformedSelection);
                                return;
                            }
                            if (transformedSelection.kind !== Kind.FIELD) {
                                newSelections.push(transformedSelection);
                                return;
                            }
                            const typeMapping = mapping[parentTypeName];
                            if (typeMapping == null) {
                                newSelections.push(transformedSelection);
                                return;
                            }
                            const oldName = mapping[parentTypeName][newName];
                            if (oldName == null) {
                                newSelections.push(transformedSelection);
                                return;
                            }
                            newSelections.push({
                                ...transformedSelection,
                                name: {
                                    kind: Kind.NAME,
                                    value: oldName,
                                },
                                alias: {
                                    kind: Kind.NAME,
                                    value: newName,
                                },
                            });
                        });
                        return {
                            ...node,
                            selections: newSelections,
                        };
                    }
                },
            },
        }));
        return newDocument;
    }
}

class TransformObjectFields {
    constructor(objectFieldTransformer, fieldNodeTransformer) {
        this.objectFieldTransformer = objectFieldTransformer;
        this.fieldNodeTransformer = fieldNodeTransformer;
    }
    transformSchema(originalSchema) {
        const compositeToObjectFieldTransformer = (typeName, fieldName, fieldConfig) => {
            if (isObjectType(originalSchema.getType(typeName))) {
                return this.objectFieldTransformer(typeName, fieldName, fieldConfig);
            }
            return undefined;
        };
        this.transformer = new TransformCompositeFields(compositeToObjectFieldTransformer, this.fieldNodeTransformer);
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class TransformRootFields {
    constructor(rootFieldTransformer, fieldNodeTransformer) {
        const rootToObjectFieldTransformer = (typeName, fieldName, fieldConfig) => {
            if (typeName === 'Query' || typeName === 'Mutation' || typeName === 'Subscription') {
                return rootFieldTransformer(typeName, fieldName, fieldConfig);
            }
            return undefined;
        };
        this.transformer = new TransformObjectFields(rootToObjectFieldTransformer, fieldNodeTransformer);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class RenameRootFields {
    constructor(renamer) {
        this.transformer = new TransformRootFields((operation, fieldName, fieldConfig) => [renamer(operation, fieldName, fieldConfig), fieldConfig]);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class FilterRootFields {
    constructor(filter) {
        this.transformer = new TransformRootFields((operation, fieldName, fieldConfig) => {
            if (filter(operation, fieldName, fieldConfig)) {
                return undefined;
            }
            return null;
        });
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
}

class RenameObjectFields {
    constructor(renamer) {
        this.transformer = new TransformObjectFields((typeName, fieldName, fieldConfig) => [
            renamer(typeName, fieldName, fieldConfig),
            fieldConfig,
        ]);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class FilterObjectFields {
    constructor(filter) {
        this.transformer = new TransformObjectFields((typeName, fieldName, fieldConfig) => filter(typeName, fieldName, fieldConfig) ? undefined : null);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
}

class TransformInterfaceFields {
    constructor(interfaceFieldTransformer, fieldNodeTransformer) {
        this.interfaceFieldTransformer = interfaceFieldTransformer;
        this.fieldNodeTransformer = fieldNodeTransformer;
    }
    transformSchema(originalSchema) {
        const compositeToObjectFieldTransformer = (typeName, fieldName, fieldConfig) => {
            if (isInterfaceType(originalSchema.getType(typeName))) {
                return this.interfaceFieldTransformer(typeName, fieldName, fieldConfig);
            }
            return undefined;
        };
        this.transformer = new TransformCompositeFields(compositeToObjectFieldTransformer, this.fieldNodeTransformer);
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class RenameInterfaceFields {
    constructor(renamer) {
        this.transformer = new TransformInterfaceFields((typeName, fieldName, fieldConfig) => [
            renamer(typeName, fieldName, fieldConfig),
            fieldConfig,
        ]);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class FilterInterfaceFields {
    constructor(filter) {
        this.transformer = new TransformInterfaceFields((typeName, fieldName, fieldConfig) => filter(typeName, fieldName, fieldConfig) ? undefined : null);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
}

class TransformQuery {
    constructor({ path, queryTransformer, resultTransformer = result => result, errorPathTransformer = errorPath => [].concat(errorPath), fragments = {}, }) {
        this.path = path;
        this.queryTransformer = queryTransformer;
        this.resultTransformer = resultTransformer;
        this.errorPathTransformer = errorPathTransformer;
        this.fragments = fragments;
    }
    transformRequest(originalRequest) {
        const document = originalRequest.document;
        const pathLength = this.path.length;
        let index = 0;
        const newDocument = visit(document, {
            [Kind.FIELD]: {
                enter: node => {
                    if (index === pathLength || node.name.value !== this.path[index]) {
                        return false;
                    }
                    index++;
                    if (index === pathLength) {
                        const selectionSet = this.queryTransformer(node.selectionSet, this.fragments);
                        return {
                            ...node,
                            selectionSet,
                        };
                    }
                },
                leave: () => {
                    index--;
                },
            },
        });
        return {
            ...originalRequest,
            document: newDocument,
        };
    }
    transformResult(originalResult) {
        const data = this.transformData(originalResult.data);
        const errors = originalResult.errors;
        return {
            data,
            errors: errors != null ? this.transformErrors(errors) : undefined,
        };
    }
    transformData(data) {
        const leafIndex = this.path.length - 1;
        let index = 0;
        let newData = data;
        if (newData) {
            let next = this.path[index];
            while (index < leafIndex) {
                if (data[next]) {
                    newData = newData[next];
                }
                else {
                    break;
                }
                index++;
                next = this.path[index];
            }
            newData[next] = this.resultTransformer(newData[next]);
        }
        return newData;
    }
    transformErrors(errors) {
        return errors.map(error => {
            const path = error.path;
            let match = true;
            let index = 0;
            while (index < this.path.length) {
                if (path[index] !== this.path[index]) {
                    match = false;
                    break;
                }
                index++;
            }
            const newPath = match ? path.slice(0, index).concat(this.errorPathTransformer(path.slice(index))) : path;
            return relocatedError(error, newPath);
        });
    }
}

class MapFields {
    constructor(fieldNodeTransformerMap) {
        this.transformer = new TransformCompositeFields((_typeName, _fieldName, fieldConfig) => fieldConfig, (typeName, fieldName, fieldNode, fragments) => {
            const typeTransformers = fieldNodeTransformerMap[typeName];
            if (typeTransformers == null) {
                return fieldNode;
            }
            const fieldNodeTransformer = typeTransformers[fieldName];
            if (fieldNodeTransformer == null) {
                return fieldNode;
            }
            return fieldNodeTransformer(fieldNode, fragments);
        });
    }
    transformSchema(schema) {
        return this.transformer.transformSchema(schema);
    }
    transformRequest(request) {
        return this.transformer.transformRequest(request);
    }
}

class ExtendSchema {
    constructor({ typeDefs, resolvers = {}, defaultFieldResolver, fieldNodeTransformerMap, }) {
        this.typeDefs = typeDefs;
        this.resolvers = resolvers;
        this.defaultFieldResolver = defaultFieldResolver != null ? defaultFieldResolver : defaultMergedResolver;
        this.transformer = new MapFields(fieldNodeTransformerMap != null ? fieldNodeTransformerMap : {});
    }
    transformSchema(schema) {
        // MapFields's transformSchema function does not actually modify the schema --
        // it saves the current schema state, to be used later to transform requests.
        this.transformer.transformSchema(schema);
        return addResolversToSchema({
            schema: this.typeDefs ? extendSchema(schema, parse(this.typeDefs)) : schema,
            resolvers: this.resolvers != null ? this.resolvers : {},
            defaultFieldResolver: this.defaultFieldResolver,
        });
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class WrapFields {
    constructor(outerTypeName, wrappingFieldNames, wrappingTypeNames, fieldNames) {
        this.outerTypeName = outerTypeName;
        this.wrappingFieldNames = wrappingFieldNames;
        this.wrappingTypeNames = wrappingTypeNames;
        this.numWraps = wrappingFieldNames.length;
        this.fieldNames = fieldNames;
        const remainingWrappingFieldNames = this.wrappingFieldNames.slice();
        const outerMostWrappingFieldName = remainingWrappingFieldNames.shift();
        this.transformer = new MapFields({
            [outerTypeName]: {
                [outerMostWrappingFieldName]: (fieldNode, fragments) => hoistFieldNodes({
                    fieldNode,
                    path: remainingWrappingFieldNames,
                    fieldNames: this.fieldNames,
                    fragments,
                }),
            },
        });
    }
    transformSchema(schema) {
        const targetFieldConfigMap = selectObjectFields(schema, this.outerTypeName, !this.fieldNames ? () => true : fieldName => this.fieldNames.includes(fieldName));
        let wrapIndex = this.numWraps - 1;
        let wrappingTypeName = this.wrappingTypeNames[wrapIndex];
        let wrappingFieldName = this.wrappingFieldNames[wrapIndex];
        let newSchema = appendObjectFields(schema, wrappingTypeName, targetFieldConfigMap);
        for (wrapIndex--; wrapIndex > -1; wrapIndex--) {
            const nextWrappingTypeName = this.wrappingTypeNames[wrapIndex];
            newSchema = appendObjectFields(newSchema, nextWrappingTypeName, {
                [wrappingFieldName]: {
                    type: newSchema.getType(wrappingTypeName),
                    resolve: defaultMergedResolver,
                },
            });
            wrappingTypeName = nextWrappingTypeName;
            wrappingFieldName = this.wrappingFieldNames[wrapIndex];
        }
        const selectedFieldNames = Object.keys(targetFieldConfigMap);
        [newSchema] = modifyObjectFields(newSchema, this.outerTypeName, fieldName => selectedFieldNames.includes(fieldName), {
            [wrappingFieldName]: {
                type: newSchema.getType(wrappingTypeName),
                resolve: createMergedResolver({ dehoist: true }),
            },
        });
        return this.transformer.transformSchema(newSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class WrapType {
    constructor(outerTypeName, innerTypeName, fieldName) {
        this.transformer = new WrapFields(outerTypeName, [fieldName], [innerTypeName], undefined);
    }
    transformSchema(schema) {
        return this.transformer.transformSchema(schema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class HoistField {
    constructor(typeName, path, newFieldName) {
        this.typeName = typeName;
        this.path = path;
        this.newFieldName = newFieldName;
        this.pathToField = this.path.slice();
        this.oldFieldName = this.pathToField.pop();
        this.transformer = new MapFields({
            [typeName]: {
                [newFieldName]: fieldNode => wrapFieldNode(renameFieldNode(fieldNode, this.oldFieldName), this.pathToField),
            },
        });
    }
    transformSchema(schema) {
        const innerType = this.pathToField.reduce((acc, pathSegment) => getNullableType(acc.getFields()[pathSegment].type), schema.getType(this.typeName));
        let [newSchema, targetFieldConfigMap] = removeObjectFields(schema, innerType.name, fieldName => fieldName === this.oldFieldName);
        const targetField = targetFieldConfigMap[this.oldFieldName];
        const targetType = targetField.type;
        newSchema = appendObjectFields(newSchema, this.typeName, {
            [this.newFieldName]: {
                type: targetType,
                resolve: createMergedResolver({ fromPath: this.pathToField }),
            },
        });
        return this.transformer.transformSchema(newSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}

class WrapQuery {
    constructor(path, wrapper, extractor) {
        this.path = path;
        this.wrapper = wrapper;
        this.extractor = extractor;
    }
    transformRequest(originalRequest) {
        const document = originalRequest.document;
        const fieldPath = [];
        const ourPath = JSON.stringify(this.path);
        const newDocument = visit(document, {
            [Kind.FIELD]: {
                enter: (node) => {
                    fieldPath.push(node.name.value);
                    if (ourPath === JSON.stringify(fieldPath)) {
                        const wrapResult = this.wrapper(node.selectionSet);
                        // Selection can be either a single selection or a selection set. If it's just one selection,
                        // let's wrap it in a selection set. Otherwise, keep it as is.
                        const selectionSet = wrapResult != null && wrapResult.kind === Kind.SELECTION_SET
                            ? wrapResult
                            : {
                                kind: Kind.SELECTION_SET,
                                selections: [wrapResult],
                            };
                        return {
                            ...node,
                            selectionSet,
                        };
                    }
                },
                leave: () => {
                    fieldPath.pop();
                },
            },
        });
        return {
            ...originalRequest,
            document: newDocument,
        };
    }
    transformResult(originalResult) {
        const rootData = originalResult.data;
        if (rootData != null) {
            let data = rootData;
            const path = [...this.path];
            while (path.length > 1) {
                const next = path.shift();
                if (data[next]) {
                    data = data[next];
                }
            }
            data[path[0]] = this.extractor(data[path[0]]);
        }
        return {
            data: rootData,
            errors: originalResult.errors,
        };
    }
}

class ExtractField {
    constructor({ from, to }) {
        this.from = from;
        this.to = to;
    }
    transformRequest(originalRequest) {
        let fromSelection;
        const ourPathFrom = JSON.stringify(this.from);
        const ourPathTo = JSON.stringify(this.to);
        let fieldPath = [];
        visit(originalRequest.document, {
            [Kind.FIELD]: {
                enter: (node) => {
                    fieldPath.push(node.name.value);
                    if (ourPathFrom === JSON.stringify(fieldPath)) {
                        fromSelection = node.selectionSet;
                        return BREAK;
                    }
                },
                leave: () => {
                    fieldPath.pop();
                },
            },
        });
        fieldPath = [];
        const newDocument = visit(originalRequest.document, {
            [Kind.FIELD]: {
                enter: (node) => {
                    fieldPath.push(node.name.value);
                    if (ourPathTo === JSON.stringify(fieldPath) && fromSelection != null) {
                        return {
                            ...node,
                            selectionSet: fromSelection,
                        };
                    }
                },
                leave: () => {
                    fieldPath.pop();
                },
            },
        });
        return {
            ...originalRequest,
            document: newDocument,
        };
    }
}

function makeRemoteExecutableSchema({ schema: schemaOrTypeDefs, executor, subscriber, createResolver = defaultCreateRemoteResolver, buildSchemaOptions, }) {
    const targetSchema = typeof schemaOrTypeDefs === 'string' ? buildSchema(schemaOrTypeDefs, buildSchemaOptions) : schemaOrTypeDefs;
    return wrapSchema({
        schema: targetSchema,
        createProxyingResolver: () => createResolver(executor, subscriber),
    });
}
function defaultCreateRemoteResolver(executor, subscriber) {
    return (_parent, _args, context, info) => delegateToSchema({
        schema: { schema: info.schema, executor, subscriber },
        context,
        info,
    });
}

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
async function introspectSchema(executor, context) {
    const parsedIntrospectionQuery = parse(getIntrospectionQuery());
    const introspectionResult = await executor({
        document: parsedIntrospectionQuery,
        context,
    });
    return getSchemaFromIntrospection(introspectionResult);
}
function introspectSchemaSync(executor, context) {
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

export { ExtendSchema, ExtractField, FilterInterfaceFields, FilterObjectFields, FilterRootFields, FilterTypes, HoistField, MapFields, RenameInterfaceFields, RenameObjectFields, RenameRootFields, RenameRootTypes, RenameTypes, TransformCompositeFields, TransformInterfaceFields, TransformObjectFields, TransformQuery, TransformRootFields, WrapFields, WrapQuery, WrapType, defaultCreateProxyingResolver, defaultCreateRemoteResolver, generateProxyingResolvers, introspectSchema, introspectSchemaSync, makeRemoteExecutableSchema, wrapSchema };
//# sourceMappingURL=index.esm.js.map