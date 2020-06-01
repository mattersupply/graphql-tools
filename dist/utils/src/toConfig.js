export function inputFieldToFieldConfig(field) {
    return {
        description: field.description,
        type: field.type,
        defaultValue: field.defaultValue,
        extensions: field.extensions,
        astNode: field.astNode,
    };
}
export function fieldToFieldConfig(field) {
    return {
        description: field.description,
        type: field.type,
        args: argsToFieldConfigArgumentMap(field.args),
        resolve: field.resolve,
        subscribe: field.subscribe,
        deprecationReason: field.deprecationReason,
        extensions: field.extensions,
        astNode: field.astNode,
    };
}
export function argsToFieldConfigArgumentMap(args) {
    const newArguments = {};
    args.forEach(arg => {
        newArguments[arg.name] = argumentToArgumentConfig(arg);
    });
    return newArguments;
}
export function argumentToArgumentConfig(arg) {
    return {
        description: arg.description,
        type: arg.type,
        defaultValue: arg.defaultValue,
        extensions: arg.extensions,
        astNode: arg.astNode,
    };
}
//# sourceMappingURL=toConfig.js.map