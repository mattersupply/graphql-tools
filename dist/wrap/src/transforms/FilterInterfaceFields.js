import TransformInterfaceFields from './TransformInterfaceFields';
export default class FilterInterfaceFields {
    constructor(filter) {
        this.transformer = new TransformInterfaceFields((typeName, fieldName, fieldConfig) => filter(typeName, fieldName, fieldConfig) ? undefined : null);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
}
//# sourceMappingURL=FilterInterfaceFields.js.map