import TransformRootFields from './TransformRootFields';
export default class RenameRootFields {
    constructor(renamer) {
        this.transformer = new TransformRootFields((operation, fieldName, fieldConfig) => [renamer(operation, fieldName, fieldConfig), fieldConfig]);
    }
    transformSchema(originalSchema) {
        return this.transformer.transformSchema(originalSchema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}
//# sourceMappingURL=RenameRootFields.js.map