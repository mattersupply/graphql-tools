import { Kind } from 'graphql';
import { mergeProxiedResults } from './proxiedResult';
function buildDelegationPlan(mergedTypeInfo, originalSelections, sourceSubschemas, targetSubschemas) {
    // 1.  calculate if possible to delegate to given subschema
    //    TODO: change logic so that required selection set can be spread across multiple subschemas?
    const proxiableSubschemas = [];
    const nonProxiableSubschemas = [];
    targetSubschemas.forEach(t => {
        if (sourceSubschemas.some(s => {
            const selectionSet = mergedTypeInfo.selectionSets.get(t);
            return mergedTypeInfo.containsSelectionSet.get(s).get(selectionSet);
        })) {
            proxiableSubschemas.push(t);
        }
        else {
            nonProxiableSubschemas.push(t);
        }
    });
    const { uniqueFields, nonUniqueFields } = mergedTypeInfo;
    const unproxiableSelections = [];
    // 2. for each selection:
    const delegationMap = new Map();
    originalSelections.forEach(selection => {
        // 2a. use uniqueFields map to assign fields to subschema if one of possible subschemas
        const uniqueSubschema = uniqueFields[selection.name.value];
        if (uniqueSubschema != null) {
            if (proxiableSubschemas.includes(uniqueSubschema)) {
                const existingSubschema = delegationMap.get(uniqueSubschema);
                if (existingSubschema != null) {
                    existingSubschema.push(selection);
                }
                else {
                    delegationMap.set(uniqueSubschema, [selection]);
                }
            }
            else {
                unproxiableSelections.push(selection);
            }
        }
        else {
            // 2b. use nonUniqueFields to assign to a possible subschema,
            //     preferring one of the subschemas already targets of delegation
            let nonUniqueSubschemas = nonUniqueFields[selection.name.value];
            nonUniqueSubschemas = nonUniqueSubschemas.filter(s => proxiableSubschemas.includes(s));
            if (nonUniqueSubschemas != null) {
                const subschemas = Array.from(delegationMap.keys());
                const existingSubschema = nonUniqueSubschemas.find(s => subschemas.includes(s));
                if (existingSubschema != null) {
                    delegationMap.get(existingSubschema).push(selection);
                }
                else {
                    delegationMap.set(nonUniqueSubschemas[0], [selection]);
                }
            }
            else {
                unproxiableSelections.push(selection);
            }
        }
    });
    return {
        delegationMap,
        unproxiableSelections,
        proxiableSubschemas,
        nonProxiableSubschemas,
    };
}
export function mergeFields(mergedTypeInfo, typeName, object, originalSelections, sourceSubschemas, targetSubschemas, context, info) {
    if (!originalSelections.length) {
        return object;
    }
    const { delegationMap, unproxiableSelections, proxiableSubschemas, nonProxiableSubschemas } = buildDelegationPlan(mergedTypeInfo, originalSelections, sourceSubschemas, targetSubschemas);
    if (!delegationMap.size) {
        return object;
    }
    const maybePromises = [];
    delegationMap.forEach((selections, s) => {
        const maybePromise = s.merge[typeName].resolve(object, context, info, s, {
            kind: Kind.SELECTION_SET,
            selections,
        });
        maybePromises.push(maybePromise);
    });
    let containsPromises = false;
    for (const maybePromise of maybePromises) {
        if (maybePromise instanceof Promise) {
            containsPromises = true;
            break;
        }
    }
    return containsPromises
        ? Promise.all(maybePromises).then(results => mergeFields(mergedTypeInfo, typeName, mergeProxiedResults(object, ...results), unproxiableSelections, sourceSubschemas.concat(proxiableSubschemas), nonProxiableSubschemas, context, info))
        : mergeFields(mergedTypeInfo, typeName, mergeProxiedResults(object, ...maybePromises), unproxiableSelections, sourceSubschemas.concat(proxiableSubschemas), nonProxiableSubschemas, context, info);
}
//# sourceMappingURL=mergeFields.js.map