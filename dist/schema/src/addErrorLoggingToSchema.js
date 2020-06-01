import { mapSchema, MapperKind } from '@graphql-tools/utils';
import { decorateWithLogger } from './decorateWithLogger';
export function addErrorLoggingToSchema(schema, logger) {
    if (!logger) {
        throw new Error('Must provide a logger');
    }
    if (typeof logger.log !== 'function') {
        throw new Error('Logger.log must be a function');
    }
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => ({
            ...fieldConfig,
            resolve: decorateWithLogger(fieldConfig.resolve, logger, `${typeName}.${fieldName}`),
        }),
    });
}
//# sourceMappingURL=addErrorLoggingToSchema.js.map