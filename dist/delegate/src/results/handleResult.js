import { getNullableType, isCompositeType, isLeafType, isListType, } from 'graphql';
import { handleNull } from './handleNull';
import { handleObject } from './handleObject';
import { handleList } from './handleList';
export function handleResult(result, errors, subschema, context, info, returnType = info.returnType, skipTypeMerging) {
    const type = getNullableType(returnType);
    if (result == null) {
        return handleNull(errors);
    }
    if (isLeafType(type)) {
        return type.parseValue(result);
    }
    else if (isCompositeType(type)) {
        return handleObject(type, result, errors, subschema, context, info, skipTypeMerging);
    }
    else if (isListType(type)) {
        return handleList(type, result, errors, subschema, context, info, skipTypeMerging);
    }
}
//# sourceMappingURL=handleResult.js.map