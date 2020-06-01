import { GraphQLObjectType, GraphQLInterfaceType, GraphQLInputObjectType, GraphQLString, GraphQLInt, GraphQLFloat, GraphQLBoolean, GraphQLID, isObjectType, isInterfaceType, isInputObjectType, Kind, GraphQLList, GraphQLNonNull, } from 'graphql';
export function createNamedStub(name, type) {
    let constructor;
    if (type === 'object') {
        constructor = GraphQLObjectType;
    }
    else if (type === 'interface') {
        constructor = GraphQLInterfaceType;
    }
    else {
        constructor = GraphQLInputObjectType;
    }
    return new constructor({
        name,
        fields: {
            __fake: {
                type: GraphQLString,
            },
        },
    });
}
export function createStub(node, type) {
    switch (node.kind) {
        case Kind.LIST_TYPE:
            return new GraphQLList(createStub(node.type, type));
        case Kind.NON_NULL_TYPE:
            return new GraphQLNonNull(createStub(node.type, type));
        default:
            if (type === 'output') {
                return createNamedStub(node.name.value, 'object');
            }
            return createNamedStub(node.name.value, 'input');
    }
}
export function isNamedStub(type) {
    if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
        const fields = type.getFields();
        const fieldNames = Object.keys(fields);
        return fieldNames.length === 1 && fields[fieldNames[0]].name === '__fake';
    }
    return false;
}
export function getBuiltInForStub(type) {
    switch (type.name) {
        case GraphQLInt.name:
            return GraphQLInt;
        case GraphQLFloat.name:
            return GraphQLFloat;
        case GraphQLString.name:
            return GraphQLString;
        case GraphQLBoolean.name:
            return GraphQLBoolean;
        case GraphQLID.name:
            return GraphQLID;
        default:
            return type;
    }
}
//# sourceMappingURL=stub.js.map