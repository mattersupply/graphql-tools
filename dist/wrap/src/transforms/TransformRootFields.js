import TransformObjectFields from './TransformObjectFields';
export default class TransformRootFields {
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
//# sourceMappingURL=TransformRootFields.js.map