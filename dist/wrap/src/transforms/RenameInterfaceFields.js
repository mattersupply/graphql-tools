import TransformInterfaceFields from './TransformInterfaceFields';
export default class RenameInterfaceFields {
    constructor(renamer) {
        this.transformer = new TransformInterfaceFields((typeName, fieldName, fieldConfig) => [
            renamer(typeName, fieldName, fieldConfig),
            fieldConfig,
        ]);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}
//# sourceMappingURL=RenameInterfaceFields.js.map