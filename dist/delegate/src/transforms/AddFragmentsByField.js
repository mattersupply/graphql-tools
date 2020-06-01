import { Kind, TypeInfo, visit, visitWithTypeInfo, } from 'graphql';
export default class AddFragmentsByField {
    constructor(targetSchema, mapping) {
        this.targetSchema = targetSchema;
        this.mapping = mapping;
    }
    transformRequest(originalRequest) {
        const document = addFragmentsByField(this.targetSchema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addFragmentsByField(targetSchema, document, mapping) {
    const typeInfo = new TypeInfo(targetSchema);
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
                            const fragment = mapping[parentTypeName][name];
                            if (fragment != null) {
                                selections = selections.concat(fragment);
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
//# sourceMappingURL=AddFragmentsByField.js.map