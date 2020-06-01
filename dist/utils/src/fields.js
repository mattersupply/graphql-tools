import { GraphQLObjectType } from 'graphql';
import { MapperKind } from './Interfaces';
import { mapSchema } from './mapSchema';
import { addTypes } from './addTypes';
export function appendObjectFields(schema, typeName, additionalFields) {
    if (schema.getType(typeName) == null) {
        return addTypes(schema, [
            new GraphQLObjectType({
                name: typeName,
                fields: additionalFields,
            }),
        ]);
    }
    return mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: type => {
            if (type.name === typeName) {
                const config = type.toConfig();
                const originalFieldConfigMap = config.fields;
                const newFieldConfigMap = {};
                Object.keys(originalFieldConfigMap).forEach(fieldName => {
                    newFieldConfigMap[fieldName] = originalFieldConfigMap[fieldName];
                });
                Object.keys(additionalFields).forEach(fieldName => {
                    newFieldConfigMap[fieldName] = additionalFields[fieldName];
                });
                return new GraphQLObjectType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
        },
    });
}
export function removeObjectFields(schema, typeName, testFn) {
    const removedFields = {};
    const newSchema = mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: type => {
            if (type.name === typeName) {
                const config = type.toConfig();
                const originalFieldConfigMap = config.fields;
                const newFieldConfigMap = {};
                Object.keys(originalFieldConfigMap).forEach(fieldName => {
                    const originalFieldConfig = originalFieldConfigMap[fieldName];
                    if (testFn(fieldName, originalFieldConfig)) {
                        removedFields[fieldName] = originalFieldConfig;
                    }
                    else {
                        newFieldConfigMap[fieldName] = originalFieldConfig;
                    }
                });
                return new GraphQLObjectType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
        },
    });
    return [newSchema, removedFields];
}
export function selectObjectFields(schema, typeName, testFn) {
    const selectedFields = {};
    mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: type => {
            if (type.name === typeName) {
                const config = type.toConfig();
                const originalFieldConfigMap = config.fields;
                Object.keys(originalFieldConfigMap).forEach(fieldName => {
                    const originalFieldConfig = originalFieldConfigMap[fieldName];
                    if (testFn(fieldName, originalFieldConfig)) {
                        selectedFields[fieldName] = originalFieldConfig;
                    }
                });
            }
            return undefined;
        },
    });
    return selectedFields;
}
export function modifyObjectFields(schema, typeName, testFn, newFields) {
    const removedFields = {};
    const newSchema = mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: type => {
            if (type.name === typeName) {
                const config = type.toConfig();
                const originalFieldConfigMap = config.fields;
                const newFieldConfigMap = {};
                Object.keys(originalFieldConfigMap).forEach(fieldName => {
                    const originalFieldConfig = originalFieldConfigMap[fieldName];
                    if (testFn(fieldName, originalFieldConfig)) {
                        removedFields[fieldName] = originalFieldConfig;
                    }
                    else {
                        newFieldConfigMap[fieldName] = originalFieldConfig;
                    }
                });
                Object.keys(newFields).forEach(fieldName => {
                    const fieldConfig = newFields[fieldName];
                    newFieldConfigMap[fieldName] = fieldConfig;
                });
                return new GraphQLObjectType({
                    ...config,
                    fields: newFieldConfigMap,
                });
            }
        },
    });
    return [newSchema, removedFields];
}
//# sourceMappingURL=fields.js.map