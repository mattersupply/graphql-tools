import { isInterfaceType } from 'graphql';
import TransformCompositeFields from './TransformCompositeFields';
export default class TransformInterfaceFields {
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
//# sourceMappingURL=TransformInterfaceFields.js.map