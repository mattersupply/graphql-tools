import { Kind, typeFromAST, } from 'graphql';
import { serializeInputValue, updateArgument } from '@graphql-tools/utils';
export function getDelegatingOperation(parentType, schema) {
    if (parentType === schema.getMutationType()) {
        return 'mutation';
    }
    else if (parentType === schema.getSubscriptionType()) {
        return 'subscription';
    }
    return 'query';
}
export function createRequestFromInfo({ info, operation = getDelegatingOperation(info.parentType, info.schema), fieldName = info.fieldName, selectionSet, fieldNodes = info.fieldNodes, }) {
    return createRequest({
        sourceSchema: info.schema,
        sourceParentType: info.parentType,
        sourceFieldName: info.fieldName,
        fragments: info.fragments,
        variableDefinitions: info.operation.variableDefinitions,
        variableValues: info.variableValues,
        targetOperation: operation,
        targetFieldName: fieldName,
        selectionSet,
        fieldNodes,
    });
}
export function createRequest({ sourceSchema, sourceParentType, sourceFieldName, fragments, variableDefinitions, variableValues, targetOperation, targetFieldName, selectionSet, fieldNodes, }) {
    var _a;
    let newSelectionSet = selectionSet;
    let argumentNodeMap;
    if (fieldNodes == null) {
        argumentNodeMap = Object.create(null);
    }
    else {
        const selections = fieldNodes.reduce((acc, fieldNode) => (fieldNode.selectionSet != null ? acc.concat(fieldNode.selectionSet.selections) : acc), []);
        newSelectionSet = selections.length
            ? {
                kind: Kind.SELECTION_SET,
                selections,
            }
            : undefined;
        argumentNodeMap = {};
        const args = (_a = fieldNodes[0]) === null || _a === void 0 ? void 0 : _a.arguments;
        if (args) {
            argumentNodeMap = args.reduce((prev, curr) => ({
                ...prev,
                [curr.name.value]: curr,
            }), argumentNodeMap);
        }
    }
    const newVariables = Object.create(null);
    const variableDefinitionMap = Object.create(null);
    if (sourceSchema != null && variableDefinitions != null) {
        variableDefinitions.forEach(def => {
            const varName = def.variable.name.value;
            variableDefinitionMap[varName] = def;
            const varType = typeFromAST(sourceSchema, def.type);
            const serializedValue = serializeInputValue(varType, variableValues[varName]);
            if (serializedValue !== undefined) {
                newVariables[varName] = serializedValue;
            }
        });
    }
    if (sourceParentType != null) {
        updateArgumentsWithDefaults(sourceParentType, sourceFieldName, argumentNodeMap, variableDefinitionMap, newVariables);
    }
    const rootfieldNode = {
        kind: Kind.FIELD,
        arguments: Object.keys(argumentNodeMap).map(argName => argumentNodeMap[argName]),
        name: {
            kind: Kind.NAME,
            value: targetFieldName || fieldNodes[0].name.value,
        },
        selectionSet: newSelectionSet,
    };
    const operationDefinition = {
        kind: Kind.OPERATION_DEFINITION,
        operation: targetOperation,
        variableDefinitions: Object.keys(variableDefinitionMap).map(varName => variableDefinitionMap[varName]),
        selectionSet: {
            kind: Kind.SELECTION_SET,
            selections: [rootfieldNode],
        },
    };
    let definitions = [operationDefinition];
    if (fragments != null) {
        definitions = definitions.concat(Object.keys(fragments).map(fragmentName => fragments[fragmentName]));
    }
    const document = {
        kind: Kind.DOCUMENT,
        definitions,
    };
    return {
        document,
        variables: newVariables,
    };
}
function updateArgumentsWithDefaults(sourceParentType, sourceFieldName, argumentNodeMap, variableDefinitionMap, variableValues) {
    const sourceField = sourceParentType.getFields()[sourceFieldName];
    sourceField.args.forEach((argument) => {
        const argName = argument.name;
        const sourceArgType = argument.type;
        if (argumentNodeMap[argName] === undefined) {
            const defaultValue = argument.defaultValue;
            if (defaultValue !== undefined) {
                updateArgument(argName, sourceArgType, argumentNodeMap, variableDefinitionMap, variableValues, serializeInputValue(sourceArgType, defaultValue));
            }
        }
    });
}
//# sourceMappingURL=createRequest.js.map