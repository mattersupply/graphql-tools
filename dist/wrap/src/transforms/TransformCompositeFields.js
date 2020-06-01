import { TypeInfo, visit, visitWithTypeInfo, Kind, GraphQLInterfaceType, isObjectType, isInterfaceType, GraphQLObjectType, } from 'graphql';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
export default class TransformCompositeFields {
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
//# sourceMappingURL=TransformCompositeFields.js.map