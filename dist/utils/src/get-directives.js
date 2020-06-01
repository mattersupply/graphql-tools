import { getArgumentValues } from './getArgumentValues';
export function getDirectives(schema, node) {
    const schemaDirectives = schema && schema.getDirectives ? schema.getDirectives() : [];
    const schemaDirectiveMap = schemaDirectives.reduce((schemaDirectiveMap, schemaDirective) => {
        schemaDirectiveMap[schemaDirective.name] = schemaDirective;
        return schemaDirectiveMap;
    }, {});
    let astNodes = [];
    if (node.astNode) {
        astNodes.push(node.astNode);
    }
    if ('extensionASTNodes' in node && node.extensionASTNodes) {
        astNodes = [...astNodes, ...node.extensionASTNodes];
    }
    const result = {};
    astNodes.forEach(astNode => {
        if (astNode.directives) {
            astNode.directives.forEach(directive => {
                const schemaDirective = schemaDirectiveMap[directive.name.value];
                if (schemaDirective) {
                    const directiveValue = getDirectiveValues(schemaDirective, astNode);
                    if (schemaDirective.isRepeatable) {
                        if (result[schemaDirective.name]) {
                            result[schemaDirective.name] = result[schemaDirective.name].concat([directiveValue]);
                        }
                        else {
                            result[schemaDirective.name] = [directiveValue];
                        }
                    }
                    else {
                        result[schemaDirective.name] = directiveValue;
                    }
                }
            });
        }
    });
    return result;
}
// graphql-js getDirectiveValues does not handle repeatable directives
function getDirectiveValues(directiveDef, node) {
    if (node.directives) {
        if (directiveDef.isRepeatable) {
            const directiveNodes = node.directives.filter(directive => directive.name.value === directiveDef.name);
            return directiveNodes.map(directiveNode => getArgumentValues(directiveDef, directiveNode));
        }
        const directiveNode = node.directives.find(directive => directive.name.value === directiveDef.name);
        return getArgumentValues(directiveDef, directiveNode);
    }
}
//# sourceMappingURL=get-directives.js.map