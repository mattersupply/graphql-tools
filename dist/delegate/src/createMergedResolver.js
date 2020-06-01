import { unwrapResult, dehoistResult } from './proxiedResult';
import { defaultMergedResolver } from './defaultMergedResolver';
export function createMergedResolver({ fromPath, dehoist, delimeter = '__gqltf__', }) {
    const parentErrorResolver = (parent, args, context, info) => parent instanceof Error ? parent : defaultMergedResolver(parent, args, context, info);
    const unwrappingResolver = fromPath != null
        ? (parent, args, context, info) => parentErrorResolver(unwrapResult(parent, fromPath), args, context, info)
        : parentErrorResolver;
    const dehoistingResolver = dehoist
        ? (parent, args, context, info) => unwrappingResolver(dehoistResult(parent, delimeter), args, context, info)
        : unwrappingResolver;
    const noParentResolver = (parent, args, context, info) => parent ? dehoistingResolver(parent, args, context, info) : {};
    return noParentResolver;
}
//# sourceMappingURL=createMergedResolver.js.map