import { mergeDirectives } from './directives';
import { mergeNamedTypeArray } from './merge-named-type-array';
export function mergeUnion(first, second, config) {
    if (second) {
        return {
            name: first.name,
            description: first['description'] || second['description'],
            directives: mergeDirectives(first.directives, second.directives, config),
            kind: (config && config.convertExtensions) ||
                first.kind === 'UnionTypeDefinition' ||
                second.kind === 'UnionTypeDefinition'
                ? 'UnionTypeDefinition'
                : 'UnionTypeExtension',
            loc: first.loc,
            types: mergeNamedTypeArray(first.types, second.types, config),
        };
    }
    return config && config.convertExtensions
        ? {
            ...first,
            kind: 'UnionTypeDefinition',
        }
        : first;
}
//# sourceMappingURL=union.js.map