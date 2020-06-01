import { Kind } from 'graphql';
import { astFromType } from './astFromType';
export function updateArgument(argName, argType, argumentNodes, variableDefinitionsMap, variableValues, newArg) {
    let varName;
    let numGeneratedVariables = 0;
    do {
        varName = `_v${(numGeneratedVariables++).toString()}_${argName}`;
    } while (varName in variableDefinitionsMap);
    argumentNodes[argName] = {
        kind: Kind.ARGUMENT,
        name: {
            kind: Kind.NAME,
            value: argName,
        },
        value: {
            kind: Kind.VARIABLE,
            name: {
                kind: Kind.NAME,
                value: varName,
            },
        },
    };
    variableDefinitionsMap[varName] = {
        kind: Kind.VARIABLE_DEFINITION,
        variable: {
            kind: Kind.VARIABLE,
            name: {
                kind: Kind.NAME,
                value: varName,
            },
        },
        type: astFromType(argType),
    };
    if (newArg === undefined) {
        delete variableValues[varName];
    }
    else {
        variableValues[varName] = newArg;
    }
}
//# sourceMappingURL=updateArgument.js.map