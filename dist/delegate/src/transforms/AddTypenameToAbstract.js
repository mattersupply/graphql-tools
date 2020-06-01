import { TypeInfo, visit, visitWithTypeInfo, Kind, isAbstractType, } from 'graphql';
export default class AddTypenameToAbstract {
    constructor(targetSchema) {
        this.targetSchema = targetSchema;
    }
    transformRequest(originalRequest) {
        const document = addTypenameToAbstract(this.targetSchema, originalRequest.document);
        return {
            ...originalRequest,
            document,
        };
    }
}
function addTypenameToAbstract(targetSchema, document) {
    const typeInfo = new TypeInfo(targetSchema);
    return visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.SELECTION_SET](node) {
            const parentType = typeInfo.getParentType();
            let selections = node.selections;
            if (parentType != null && isAbstractType(parentType)) {
                selections = selections.concat({
                    kind: Kind.FIELD,
                    name: {
                        kind: Kind.NAME,
                        value: '__typename',
                    },
                });
            }
            if (selections !== node.selections) {
                return {
                    ...node,
                    selections,
                };
            }
        },
    }));
}
//# sourceMappingURL=AddTypenameToAbstract.js.map