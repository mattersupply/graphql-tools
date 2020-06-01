import TransformObjectFields from './TransformObjectFields';
export default class RenameObjectFields {
    constructor(renamer) {
        this.transformer = new TransformObjectFields((typeName, fieldName, fieldConfig) => [
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
//# sourceMappingURL=RenameObjectFields.js.map