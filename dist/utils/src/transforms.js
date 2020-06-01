import { cloneSchema } from './clone';
export function applySchemaTransforms(originalSchema, transforms) {
    return transforms.reduce((schema, transform) => transform.transformSchema != null ? transform.transformSchema(cloneSchema(schema)) : schema, originalSchema);
}
export function applyRequestTransforms(originalRequest, transforms) {
    return transforms.reduce((request, transform) => transform.transformRequest != null ? transform.transformRequest(request) : request, originalRequest);
}
export function applyResultTransforms(originalResult, transforms) {
    return transforms.reduceRight((result, transform) => transform.transformResult != null ? transform.transformResult(result) : result, originalResult);
}
//# sourceMappingURL=transforms.js.map