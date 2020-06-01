import { Kind, TypeInfo, parse, visit, visitWithTypeInfo, } from 'graphql';
import { concatInlineFragments } from '@graphql-tools/utils';
export default class ReplaceFieldWithFragment {
    constructor(targetSchema, fragments) {
        this.targetSchema = targetSchema;
        this.mapping = {};
        for (const { field, fragment } of fragments) {
            const parsedFragment = parseFragmentToInlineFragment(fragment);
            const actualTypeName = parsedFragment.typeCondition.name.value;
            if (!(actualTypeName in this.mapping)) {
                this.mapping[actualTypeName] = Object.create(null);
            }
            const typeMapping = this.mapping[actualTypeName];
            if (!(field in typeMapping)) {
                typeMapping[field] = [parsedFragment];
            }
            else {
                typeMapping[field].push(parsedFragment);
            }
        }
    }
    transformRequest(originalRequest) {
        const document = replaceFieldsWithFragments(this.targetSchema, originalRequest.document, this.mapping);
        return {
            ...originalRequest,
            document,
        };
    }
}
function replaceFieldsWithFragments(targetSchema, document, mapping) {
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
                            const fragments = mapping[parentTypeName][name];
                            if (fragments != null && fragments.length > 0) {
                                const fragment = concatInlineFragments(parentTypeName, fragments);
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
function parseFragmentToInlineFragment(definitions) {
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
//# sourceMappingURL=ReplaceFieldWithFragment.js.map