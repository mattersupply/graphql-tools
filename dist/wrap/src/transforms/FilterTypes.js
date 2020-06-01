import { mapSchema, MapperKind } from '@graphql-tools/utils';
export default class FilterTypes {
    constructor(filter) {
        this.filter = filter;
    }
    transformSchema(schema) {
        return mapSchema(schema, {
            [MapperKind.TYPE]: (type) => {
                if (this.filter(type)) {
                    return undefined;
                }
                return null;
            },
        });
    }
}
//# sourceMappingURL=FilterTypes.js.map