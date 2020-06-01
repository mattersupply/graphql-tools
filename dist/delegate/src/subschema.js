import { FIELD_SUBSCHEMA_MAP_SYMBOL, OBJECT_SUBSCHEMA_SYMBOL } from './symbols';
export function getSubschema(result, responseKey) {
    const subschema = result[FIELD_SUBSCHEMA_MAP_SYMBOL] && result[FIELD_SUBSCHEMA_MAP_SYMBOL][responseKey];
    return subschema || result[OBJECT_SUBSCHEMA_SYMBOL];
}
export function setObjectSubschema(result, subschema) {
    result[OBJECT_SUBSCHEMA_SYMBOL] = subschema;
}
//# sourceMappingURL=subschema.js.map