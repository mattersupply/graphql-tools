import { Kind, } from 'graphql';
import { serializeInputValue, updateArgument } from '@graphql-tools/utils';
export default class AddArgumentsAsVariables {
    constructor(targetSchema, args) {
        this.targetSchema = targetSchema;
        this.args = Object.entries(args).reduce((prev, [key, val]) => ({
            ...prev,
            [key]: val,
        }), {});
    }
    transformRequest(originalRequest) {
        const { document, newVariables } = addVariablesToRootField(this.targetSchema, originalRequest, this.args);
        return {
            document,
            variables: newVariables,
        };
    }
}
function addVariablesToRootField(targetSchema, originalRequest, args) {
    const document = originalRequest.document;
    const variableValues = originalRequest.variables;
    const operations = document.definitions.filter(def => def.kind === Kind.OPERATION_DEFINITION);
    const fragments = document.definitions.filter(def => def.kind === Kind.FRAGMENT_DEFINITION);
    const newOperations = operations.map((operation) => {
        const variableDefinitionMap = operation.variableDefinitions.reduce((prev, def) => ({
            ...prev,
            [def.variable.name.value]: def,
        }), {});
        let type;
        if (operation.operation === 'subscription') {
            type = targetSchema.getSubscriptionType();
        }
        else if (operation.operation === 'mutation') {
            type = targetSchema.getMutationType();
        }
        else {
            type = targetSchema.getQueryType();
        }
        const newSelectionSet = [];
        operation.selectionSet.selections.forEach((selection) => {
            if (selection.kind === Kind.FIELD) {
                const argumentNodes = selection.arguments;
                const argumentNodeMap = argumentNodes.reduce((prev, argument) => ({
                    ...prev,
                    [argument.name.value]: argument,
                }), {});
                const targetField = type.getFields()[selection.name.value];
                // excludes __typename
                if (targetField != null) {
                    updateArguments(targetField, argumentNodeMap, variableDefinitionMap, variableValues, args);
                }
                newSelectionSet.push({
                    ...selection,
                    arguments: Object.keys(argumentNodeMap).map(argName => argumentNodeMap[argName]),
                });
            }
            else {
                newSelectionSet.push(selection);
            }
        });
        return {
            ...operation,
            variableDefinitions: Object.keys(variableDefinitionMap).map(varName => variableDefinitionMap[varName]),
            selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: newSelectionSet,
            },
        };
    });
    return {
        document: {
            ...document,
            definitions: [...newOperations, ...fragments],
        },
        newVariables: variableValues,
    };
}
function updateArguments(targetField, argumentNodeMap, variableDefinitionMap, variableValues, newArgs) {
    targetField.args.forEach((argument) => {
        const argName = argument.name;
        const argType = argument.type;
        if (argName in newArgs) {
            updateArgument(argName, argType, argumentNodeMap, variableDefinitionMap, variableValues, serializeInputValue(argType, newArgs[argName]));
        }
    });
}
//# sourceMappingURL=AddArgumentsAsVariables.js.map