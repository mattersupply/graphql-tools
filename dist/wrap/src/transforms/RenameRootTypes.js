import { visit, Kind, GraphQLObjectType } from 'graphql';
import { MapperKind, mapSchema } from '@graphql-tools/utils';
export default class RenameRootTypes {
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
//# sourceMappingURL=RenameRootTypes.js.map