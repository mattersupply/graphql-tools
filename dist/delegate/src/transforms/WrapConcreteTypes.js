import { Kind, getNamedType, isAbstractType, TypeInfo, visit, visitWithTypeInfo, isObjectType, } from 'graphql';
// For motivation, see https://github.com/ardatan/graphql-tools/issues/751
export default class WrapConcreteTypes {
    constructor(returnType, targetSchema) {
        this.returnType = returnType;
        this.targetSchema = targetSchema;
    }
    transformRequest(originalRequest) {
        const document = wrapConcreteTypes(this.returnType, this.targetSchema, originalRequest.document);
        return {
            ...originalRequest,
            document,
        };
    }
}
function wrapConcreteTypes(returnType, targetSchema, document) {
    const namedType = getNamedType(returnType);
    if (!isObjectType(namedType)) {
        return document;
    }
    const queryRootType = targetSchema.getQueryType();
    const mutationRootType = targetSchema.getMutationType();
    const subscriptionRootType = targetSchema.getSubscriptionType();
    const typeInfo = new TypeInfo(targetSchema);
    const newDocument = visit(document, visitWithTypeInfo(typeInfo, {
        [Kind.FIELD](node) {
            const maybeType = typeInfo.getParentType();
            if (maybeType == null) {
                return false;
            }
            const parentType = getNamedType(maybeType);
            if (parentType !== queryRootType && parentType !== mutationRootType && parentType !== subscriptionRootType) {
                return false;
            }
            if (!isAbstractType(getNamedType(typeInfo.getType()))) {
                return false;
            }
            return {
                ...node,
                selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                        {
                            kind: Kind.INLINE_FRAGMENT,
                            typeCondition: {
                                kind: Kind.NAMED_TYPE,
                                name: {
                                    kind: Kind.NAME,
                                    value: namedType.name,
                                },
                            },
                            selectionSet: node.selectionSet,
                        },
                    ],
                },
            };
        },
    }));
    return newDocument;
}
//# sourceMappingURL=WrapConcreteTypes.js.map