import { getNullableType, isLeafType, isListType, isInputObjectType, } from 'graphql';
export function transformInputValue(type, value, transformer) {
    if (value == null) {
        return value;
    }
    const nullableType = getNullableType(type);
    if (isLeafType(nullableType)) {
        return transformer(nullableType, value);
    }
    else if (isListType(nullableType)) {
        return value.map((listMember) => transformInputValue(nullableType.ofType, listMember, transformer));
    }
    else if (isInputObjectType(nullableType)) {
        const fields = nullableType.getFields();
        const newValue = {};
        Object.keys(value).forEach(key => {
            newValue[key] = transformInputValue(fields[key].type, value[key], transformer);
        });
        return newValue;
    }
    // unreachable, no other possible return value
}
export function serializeInputValue(type, value) {
    return transformInputValue(type, value, (t, v) => t.serialize(v));
}
export function parseInputValue(type, value) {
    return transformInputValue(type, value, (t, v) => t.parseValue(v));
}
export function parseInputValueLiteral(type, value) {
    return transformInputValue(type, value, (t, v) => t.parseLiteral(v, {}));
}
//# sourceMappingURL=transformInputValue.js.map