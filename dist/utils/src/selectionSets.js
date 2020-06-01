import { parse, Kind, getNamedType } from 'graphql';
export function parseSelectionSet(selectionSet) {
    const query = parse(selectionSet).definitions[0];
    return query.selectionSet;
}
export function typeContainsSelectionSet(type, selectionSet) {
    const fields = type.getFields();
    for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
            const field = fields[selection.name.value];
            if (field == null) {
                return false;
            }
            if (selection.selectionSet != null) {
                return typeContainsSelectionSet(getNamedType(field.type), selection.selectionSet);
            }
        }
        else if (selection.kind === Kind.INLINE_FRAGMENT) {
            const containsSelectionSet = typeContainsSelectionSet(type, selection.selectionSet);
            if (!containsSelectionSet) {
                return false;
            }
        }
    }
    return true;
}
//# sourceMappingURL=selectionSets.js.map