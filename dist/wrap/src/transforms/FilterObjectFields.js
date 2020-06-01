import TransformObjectFields from './TransformObjectFields';
export default class FilterObjectFields {
    constructor(filter) {
        this.transformer = new TransformObjectFields((typeName, fieldName, fieldConfig) => filter(typeName, fieldName, fieldConfig) ? undefined : null);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
}
//# sourceMappingURL=FilterObjectFields.js.map