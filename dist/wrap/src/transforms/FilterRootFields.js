import TransformRootFields from './TransformRootFields';
export default class FilterRootFields {
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
//# sourceMappingURL=FilterRootFields.js.map