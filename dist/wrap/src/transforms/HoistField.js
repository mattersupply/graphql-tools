import { getNullableType } from 'graphql';
import { wrapFieldNode, renameFieldNode, appendObjectFields, removeObjectFields, } from '@graphql-tools/utils';
import MapFields from './MapFields';
import { createMergedResolver } from '@graphql-tools/delegate';
export default class HoistField {
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
//# sourceMappingURL=HoistField.js.map