import { isObjectType } from 'graphql';
import TransformCompositeFields from './TransformCompositeFields';
export default class TransformObjectFields {
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
//# sourceMappingURL=TransformObjectFields.js.map