import { Kind } from 'graphql';
export function renameFieldNode(fieldNode, name) {
    return {
        ...fieldNode,
        alias: {
            kind: Kind.NAME,
            value: fieldNode.alias != null ? fieldNode.alias.value : fieldNode.name.value,
        },
        name: {
            kind: Kind.NAME,
            value: name,
        },
    };
}
export function preAliasFieldNode(fieldNode, str) {
    return {
        ...fieldNode,
        alias: {
            kind: Kind.NAME,
            value: `${str}${fieldNode.alias != null ? fieldNode.alias.value : fieldNode.name.value}`,
        },
    };
}
export function wrapFieldNode(fieldNode, path) {
    let newFieldNode = fieldNode;
    path.forEach(fieldName => {
        newFieldNode = {
            kind: Kind.FIELD,
            name: {
                kind: Kind.NAME,
                value: fieldName,
            },
            selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [fieldNode],
            },
        };
    });
    return newFieldNode;
}
function collectFields(selectionSet, fragments, fields = [], visitedFragmentNames = {}) {
    if (selectionSet != null) {
        selectionSet.selections.forEach(selection => {
            switch (selection.kind) {
                case Kind.FIELD:
                    fields.push(selection);
                    break;
                case Kind.INLINE_FRAGMENT:
                    collectFields(selection.selectionSet, fragments, fields, visitedFragmentNames);
                    break;
                case Kind.FRAGMENT_SPREAD: {
                    const fragmentName = selection.name.value;
                    if (!visitedFragmentNames[fragmentName]) {
                        visitedFragmentNames[fragmentName] = true;
                        collectFields(fragments[fragmentName].selectionSet, fragments, fields, visitedFragmentNames);
                    }
                    break;
                }
                default:
                    // unreachable
                    break;
            }
        });
    }
    return fields;
}
export function hoistFieldNodes({ fieldNode, fieldNames, path = [], delimeter = '__gqltf__', fragments, }) {
    const alias = fieldNode.alias != null ? fieldNode.alias.value : fieldNode.name.value;
    let newFieldNodes = [];
    if (path.length) {
        const remainingPathSegments = path.slice();
        const initialPathSegment = remainingPathSegments.shift();
        collectFields(fieldNode.selectionSet, fragments).forEach((possibleFieldNode) => {
            if (possibleFieldNode.name.value === initialPathSegment) {
                newFieldNodes = newFieldNodes.concat(hoistFieldNodes({
                    fieldNode: preAliasFieldNode(possibleFieldNode, `${alias}${delimeter}`),
                    fieldNames,
                    path: remainingPathSegments,
                    delimeter,
                    fragments,
                }));
            }
        });
    }
    else {
        collectFields(fieldNode.selectionSet, fragments).forEach((possibleFieldNode) => {
            if (!fieldNames || fieldNames.includes(possibleFieldNode.name.value)) {
                newFieldNodes.push(preAliasFieldNode(possibleFieldNode, `${alias}${delimeter}`));
            }
        });
    }
    return newFieldNodes;
}
//# sourceMappingURL=fieldNodes.js.map