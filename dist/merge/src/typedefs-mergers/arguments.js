import { compareNodes } from '@graphql-tools/utils';
export function mergeArguments(args1, args2, config) {
    const result = deduplicateArguments([].concat(args2, args1).filter(a => a));
    if (config && config.sort) {
        result.sort(compareNodes);
    }
    return result;
}
function deduplicateArguments(args) {
    return args.reduce((acc, current) => {
        const dup = acc.find(arg => arg.name.value === current.name.value);
        if (!dup) {
            return acc.concat([current]);
        }
        return acc;
    }, []);
}
//# sourceMappingURL=arguments.js.map