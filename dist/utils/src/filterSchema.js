import { GraphQLObjectType, } from 'graphql';
import { MapperKind } from './Interfaces';
import { mapSchema } from './mapSchema';
export function filterSchema({ schema, rootFieldFilter = () => true, typeFilter = () => true, fieldFilter = () => true, }) {
    const filteredSchema = mapSchema(schema, {
        [MapperKind.QUERY]: (type) => filterRootFields(type, 'Query', rootFieldFilter),
        [MapperKind.MUTATION]: (type) => filterRootFields(type, 'Mutation', rootFieldFilter),
        [MapperKind.SUBSCRIPTION]: (type) => filterRootFields(type, 'Subscription', rootFieldFilter),
        [MapperKind.OBJECT_TYPE]: (type) => typeFilter(type.name, type) ? filterObjectFields(type, fieldFilter) : null,
        [MapperKind.INTERFACE_TYPE]: (type) => (typeFilter(type.name, type) ? undefined : null),
        [MapperKind.UNION_TYPE]: (type) => (typeFilter(type.name, type) ? undefined : null),
        [MapperKind.INPUT_OBJECT_TYPE]: (type) => (typeFilter(type.name, type) ? undefined : null),
        [MapperKind.ENUM_TYPE]: (type) => (typeFilter(type.name, type) ? undefined : null),
        [MapperKind.SCALAR_TYPE]: (type) => (typeFilter(type.name, type) ? undefined : null),
    });
    return filteredSchema;
}
function filterRootFields(type, operation, rootFieldFilter) {
    const config = type.toConfig();
    Object.keys(config.fields).forEach(fieldName => {
        if (!rootFieldFilter(operation, fieldName, config.fields[fieldName])) {
            delete config.fields[fieldName];
        }
    });
    return new GraphQLObjectType(config);
}
function filterObjectFields(type, fieldFilter) {
    const config = type.toConfig();
    Object.keys(config.fields).forEach(fieldName => {
        if (!fieldFilter(type.name, fieldName, config.fields[fieldName])) {
            delete config.fields[fieldName];
        }
    });
    return new GraphQLObjectType(config);
}
//# sourceMappingURL=filterSchema.js.map