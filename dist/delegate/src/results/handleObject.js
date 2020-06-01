import { isAbstractType, } from 'graphql';
import { collectFields, setErrors, slicedError } from '@graphql-tools/utils';
import { setObjectSubschema } from '../subschema';
import { mergeFields } from '../mergeFields';
import { isSubschemaConfig } from '../types';
export function handleObject(type, object, errors, subschema, context, info, skipTypeMerging) {
    var _a;
    const stitchingInfo = (_a = info === null || info === void 0 ? void 0 : info.schema.extensions) === null || _a === void 0 ? void 0 : _a.stitchingInfo;
    setErrors(object, errors.map(error => slicedError(error)));
    setObjectSubschema(object, subschema);
    if (skipTypeMerging || !stitchingInfo) {
        return object;
    }
    const typeName = isAbstractType(type) ? info.schema.getTypeMap()[object.__typename].name : type.name;
    const mergedTypeInfo = stitchingInfo.mergedTypes[typeName];
    let targetSubschemas;
    if (mergedTypeInfo != null) {
        targetSubschemas = mergedTypeInfo.subschemas;
    }
    if (!targetSubschemas) {
        return object;
    }
    targetSubschemas = targetSubschemas.filter(s => s !== subschema);
    if (!targetSubschemas.length) {
        return object;
    }
    const subFields = collectSubFields(info, object.__typename);
    const selections = getFieldsNotInSubschema(subFields, subschema, mergedTypeInfo, object.__typename);
    return mergeFields(mergedTypeInfo, typeName, object, selections, [subschema], targetSubschemas, context, info);
}
function collectSubFields(info, typeName) {
    let subFieldNodes = Object.create(null);
    const visitedFragmentNames = Object.create(null);
    info.fieldNodes.forEach(fieldNode => {
        subFieldNodes = collectFields({
            schema: info.schema,
            variableValues: info.variableValues,
            fragments: info.fragments,
        }, info.schema.getType(typeName), fieldNode.selectionSet, subFieldNodes, visitedFragmentNames);
    });
    return subFieldNodes;
}
function getFieldsNotInSubschema(subFieldNodes, subschema, mergedTypeInfo, typeName) {
    const typeMap = isSubschemaConfig(subschema) ? mergedTypeInfo.typeMaps.get(subschema) : subschema.getTypeMap();
    const fields = typeMap[typeName].getFields();
    const fieldsNotInSchema = [];
    Object.keys(subFieldNodes).forEach(responseName => {
        subFieldNodes[responseName].forEach(subFieldNode => {
            if (!(subFieldNode.name.value in fields)) {
                fieldsNotInSchema.push(subFieldNode);
            }
        });
    });
    return fieldsNotInSchema;
}
//# sourceMappingURL=handleObject.js.map