import { getResponseKeyFromInfo } from '@graphql-tools/utils';
import { handleResult } from '../results/handleResult';
export default class CheckResultAndHandleErrors {
    constructor(info, fieldName, subschema, context, returnType = info.returnType, typeMerge) {
        this.context = context;
        this.info = info;
        this.fieldName = fieldName;
        this.subschema = subschema;
        this.returnType = returnType;
        this.typeMerge = typeMerge;
    }
    transformResult(result) {
        return checkResultAndHandleErrors(result, this.context != null ? this.context : {}, this.info, this.fieldName, this.subschema, this.returnType, this.typeMerge);
    }
}
export function checkResultAndHandleErrors(result, context, info, responseKey = getResponseKeyFromInfo(info), subschema, returnType = info.returnType, skipTypeMerging) {
    const errors = result.errors != null ? result.errors : [];
    const data = result.data != null ? result.data[responseKey] : undefined;
    return handleResult(data, errors, subschema, context, info, returnType, skipTypeMerging);
}
//# sourceMappingURL=CheckResultAndHandleErrors.js.map