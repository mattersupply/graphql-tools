import { Kind, TypeInfo, visit, visitWithTypeInfo, } from 'graphql';
export default class AddSelectionSetsByField {
    constructor(schema, mapping) {
        this.schema = schema;
        this.mapping = mapping;
    }
    transformRequest(originalRequest) {
        const document = addSelectionSetsByField(this.schema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addSelectionSetsByField(schema, document, mapping) {
    const typeInfo = new TypeInfo(schema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            if (parentType != null) {
                const parentTypeName = parentType.name;
                let selections = node.selections;
                if (parentTypeName in mapping) {
                    node.selections.forEach(selection => {
                        if (selection.kind === Kind.FIELD) {
                            const name = selection.name.value;
                            const selectionSet = mapping[parentTypeName][name];
                            if (selectionSet != null) {
                                selections = selections.concat(selectionSet.selections);
                            }
                        }
                    });
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
//# sourceMappingURL=AddSelectionSetsByField.js.map