import { GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLObjectType, GraphQLScalarType, GraphQLUnionType, Kind, isEnumType, isInputObjectType, isInterfaceType, isObjectType, isScalarType, isSpecifiedScalarType, isUnionType, visit, } from 'graphql';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
export default class RenameTypes {
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
//# sourceMappingURL=RenameTypes.js.map