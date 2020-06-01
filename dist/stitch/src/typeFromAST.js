import { GraphQLEnumType, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLObjectType, GraphQLScalarType, GraphQLUnionType, Kind, GraphQLDirective, DirectiveLocation, TokenKind, valueFromASTUntyped, getDirectiveValues, GraphQLDeprecatedDirective, } from 'graphql';
import { createStub, createNamedStub } from '@graphql-tools/utils';
const backcompatOptions = { commentDescriptions: true };
export default function typeFromAST(node) {
    switch (node.kind) {
        case Kind.OBJECT_TYPE_DEFINITION:
            return makeObjectType(node);
        case Kind.INTERFACE_TYPE_DEFINITION:
            return makeInterfaceType(node);
        case Kind.ENUM_TYPE_DEFINITION:
            return makeEnumType(node);
        case Kind.UNION_TYPE_DEFINITION:
            return makeUnionType(node);
        case Kind.SCALAR_TYPE_DEFINITION:
            return makeScalarType(node);
        case Kind.INPUT_OBJECT_TYPE_DEFINITION:
            return makeInputObjectType(node);
        case Kind.DIRECTIVE_DEFINITION:
            return makeDirective(node);
        default:
            return null;
    }
}
function makeObjectType(node) {
    const config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: () => node.interfaces.map(iface => createNamedStub(iface.name.value, 'interface')),
        fields: () => makeFields(node.fields),
        astNode: node,
    };
    return new GraphQLObjectType(config);
}
function makeInterfaceType(node) {
    var _a;
    const config = {
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        interfaces: (_a = node.interfaces) === null || _a === void 0 ? void 0 : _a.map(iface => createNamedStub(iface.name.value, 'interface')),
        fields: () => makeFields(node.fields),
        astNode: node,
    };
    return new GraphQLInterfaceType(config);
}
function makeEnumType(node) {
    const values = node.values.reduce((prev, value) => ({
        ...prev,
        [value.name.value]: {
            description: getDescription(value, backcompatOptions),
            deprecationReason: getDeprecationReason(value),
            astNode: value,
        },
    }), {});
    return new GraphQLEnumType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        values,
        astNode: node,
    });
}
function makeUnionType(node) {
    return new GraphQLUnionType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        types: () => node.types.map(type => createNamedStub(type.name.value, 'object')),
        astNode: node,
    });
}
function makeScalarType(node) {
    return new GraphQLScalarType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        astNode: node,
        // TODO: serialize default property setting can be dropped once
        // upstream graphql-js TypeScript typings are updated, likely in v16
        serialize: value => value,
    });
}
function makeInputObjectType(node) {
    return new GraphQLInputObjectType({
        name: node.name.value,
        description: getDescription(node, backcompatOptions),
        fields: () => makeValues(node.fields),
        astNode: node,
    });
}
function makeFields(nodes) {
    return nodes.reduce((prev, node) => ({
        ...prev,
        [node.name.value]: {
            type: createStub(node.type, 'output'),
            description: getDescription(node, backcompatOptions),
            args: makeValues(node.arguments),
            deprecationReason: getDeprecationReason(node),
            astNode: node,
        },
    }), {});
}
function makeValues(nodes) {
    return nodes.reduce((prev, node) => ({
        ...prev,
        [node.name.value]: {
            type: createStub(node.type, 'input'),
            defaultValue: node.defaultValue !== undefined ? valueFromASTUntyped(node.defaultValue) : undefined,
            description: getDescription(node, backcompatOptions),
            astNode: node,
        },
    }), {});
}
function makeDirective(node) {
    const locations = [];
    node.locations.forEach(location => {
        if (location.value in DirectiveLocation) {
            locations.push(location.value);
        }
    });
    return new GraphQLDirective({
        name: node.name.value,
        description: node.description != null ? node.description.value : null,
        locations,
        isRepeatable: node.repeatable,
        args: makeValues(node.arguments),
        astNode: node,
    });
}
// graphql < v13 does not export getDescription
function getDescription(node, options) {
    if (node.description != null) {
        return node.description.value;
    }
    if (options.commentDescriptions) {
        const rawValue = getLeadingCommentBlock(node);
        if (rawValue !== undefined) {
            return dedentBlockStringValue(`\n${rawValue}`);
        }
    }
}
function getLeadingCommentBlock(node) {
    const loc = node.loc;
    if (!loc) {
        return;
    }
    const comments = [];
    let token = loc.startToken.prev;
    while (token != null &&
        token.kind === TokenKind.COMMENT &&
        token.next != null &&
        token.prev != null &&
        token.line + 1 === token.next.line &&
        token.line !== token.prev.line) {
        const value = String(token.value);
        comments.push(value);
        token = token.prev;
    }
    return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}
function dedentBlockStringValue(rawString) {
    // Expand a block string's raw value into independent lines.
    const lines = rawString.split(/\r\n|[\n\r]/g);
    // Remove common indentation from all lines but first.
    const commonIndent = getBlockStringIndentation(lines);
    if (commonIndent !== 0) {
        for (let i = 1; i < lines.length; i++) {
            lines[i] = lines[i].slice(commonIndent);
        }
    }
    // Remove leading and trailing blank lines.
    while (lines.length > 0 && isBlank(lines[0])) {
        lines.shift();
    }
    while (lines.length > 0 && isBlank(lines[lines.length - 1])) {
        lines.pop();
    }
    // Return a string of the lines joined with U+000A.
    return lines.join('\n');
}
/**
 * @internal
 */
export function getBlockStringIndentation(lines) {
    let commonIndent = null;
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const indent = leadingWhitespace(line);
        if (indent === line.length) {
            continue; // skip empty lines
        }
        if (commonIndent === null || indent < commonIndent) {
            commonIndent = indent;
            if (commonIndent === 0) {
                break;
            }
        }
    }
    return commonIndent === null ? 0 : commonIndent;
}
function leadingWhitespace(str) {
    let i = 0;
    while (i < str.length && (str[i] === ' ' || str[i] === '\t')) {
        i++;
    }
    return i;
}
function isBlank(str) {
    return leadingWhitespace(str) === str.length;
}
function getDeprecationReason(node) {
    const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
    return deprecated === null || deprecated === void 0 ? void 0 : deprecated.reason;
}
//# sourceMappingURL=typeFromAST.js.map