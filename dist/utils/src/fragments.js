import { Kind, parse } from 'graphql';
export function concatInlineFragments(type, fragments) {
    const fragmentSelections = fragments.reduce((selections, fragment) => selections.concat(fragment.selectionSet.selections), []);
    const deduplicatedFragmentSelection = deduplicateSelection(fragmentSelections);
    return {
        kind: Kind.INLINE_FRAGMENT,
        typeCondition: {
            kind: Kind.NAMED_TYPE,
            name: {
                kind: Kind.NAME,
                value: type,
            },
        },
        selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: deduplicatedFragmentSelection,
        },
    };
}
function deduplicateSelection(nodes) {
    const selectionMap = nodes.reduce((map, node) => {
        switch (node.kind) {
            case 'Field': {
                if (node.alias != null) {
                    if (node.alias.value in map) {
                        return map;
                    }
                    return {
                        ...map,
                        [node.alias.value]: node,
                    };
                }
                if (node.name.value in map) {
                    return map;
                }
                return {
                    ...map,
                    [node.name.value]: node,
                };
            }
            case 'FragmentSpread': {
                if (node.name.value in map) {
                    return map;
                }
                return {
                    ...map,
                    [node.name.value]: node,
                };
            }
            case 'InlineFragment': {
                if (map.__fragment != null) {
                    const fragment = map.__fragment;
                    return {
                        ...map,
                        __fragment: concatInlineFragments(fragment.typeCondition.name.value, [fragment, node]),
                    };
                }
                return {
                    ...map,
                    __fragment: node,
                };
            }
            default: {
                return map;
            }
        }
    }, Object.create(null));
    const selection = Object.keys(selectionMap).reduce((selectionList, node) => selectionList.concat(selectionMap[node]), []);
    return selection;
}
export function parseFragmentToInlineFragment(definitions) {
    if (definitions.trim().startsWith('fragment')) {
        const document = parse(definitions);
        for (const definition of document.definitions) {
            if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                return {
                    kind: Kind.INLINE_FRAGMENT,
                    typeCondition: definition.typeCondition,
                    selectionSet: definition.selectionSet,
                };
            }
        }
    }
    const query = parse(`{${definitions}}`).definitions[0];
    for (const selection of query.selectionSet.selections) {
        if (selection.kind === Kind.INLINE_FRAGMENT) {
            return selection;
        }
    }
    throw new Error('Could not parse fragment');
}
//# sourceMappingURL=fragments.js.map