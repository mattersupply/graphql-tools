import TransformCompositeFields from './TransformCompositeFields';
export default class MapFields {
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
//# sourceMappingURL=MapFields.js.map