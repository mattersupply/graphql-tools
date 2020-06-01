import { Kind, TypeInfo, visit, visitWithTypeInfo, } from 'graphql';
export default class AddSelectionSetsByType {
    constructor(targetSchema, mapping) {
        this.targetSchema = targetSchema;
        this.mapping = mapping;
    }
    transformRequest(originalRequest) {
        const document = addSelectionSetsByType(this.targetSchema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addSelectionSetsByType(targetSchema, document, mapping) {
    const typeInfo = new TypeInfo(targetSchema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            if (parentType != null) {
                const parentTypeName = parentType.name;
                let selections = node.selections;
                if (parentTypeName in mapping) {
                    const selectionSet = mapping[parentTypeName];
                    if (selectionSet != null) {
                        selections = selections.concat(selectionSet.selections);
                    }
                }
                if (selections !== node.selections) {
                    return {
                        ...node,
                        selections,
                    };
                }
            }
        },
    }));
}
//# sourceMappingURL=AddSelectionSetsByType.js.map