import WrapFields from './WrapFields';
export default class WrapType {
    constructor(outerTypeName, innerTypeName, fieldName) {
        this.transformer = new WrapFields(outerTypeName, [fieldName], [innerTypeName], undefined);
    }
    transformSchema(schema) {
        return this.transformer.transformSchema(schema);
    }
    transformRequest(originalRequest) {
        return this.transformer.transformRequest(originalRequest);
    }
}
//# sourceMappingURL=WrapType.js.map