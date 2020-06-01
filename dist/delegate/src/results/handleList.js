import { getNullableType, isLeafType, isCompositeType, isListType, } from 'graphql';
import { getErrorsByPathSegment } from '@graphql-tools/utils';
import { handleNull } from './handleNull';
import { handleObject } from './handleObject';
export function handleList(type, list, errors, subschema, context, info, skipTypeMerging) {
    const childErrors = getErrorsByPathSegment(errors);
    return list.map((listMember, index) => handleListMember(getNullableType(type.ofType), listMember, index in childErrors ? childErrors[index] : [], subschema, context, info, skipTypeMerging));
}
function handleListMember(type, listMember, errors, subschema, context, info, skipTypeMerging) {
    if (listMember == null) {
        return handleNull(errors);
    }
    if (isLeafType(type)) {
        return type.parseValue(listMember);
    }
    else if (isCompositeType(type)) {
        return handleObject(type, listMember, errors, subschema, context, info, skipTypeMerging);
    }
    else if (isListType(type)) {
        return handleList(type, listMember, errors, subschema, context, info, skipTypeMerging);
    }
}
//# sourceMappingURL=handleList.js.map