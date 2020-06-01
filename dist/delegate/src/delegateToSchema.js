import { subscribe, execute, validate, isSchema, getOperationAST, } from 'graphql';
import { applyRequestTransforms, applyResultTransforms, mapAsyncIterator, CombinedError, } from '@graphql-tools/utils';
import ExpandAbstractTypes from './transforms/ExpandAbstractTypes';
import WrapConcreteTypes from './transforms/WrapConcreteTypes';
import FilterToSchema from './transforms/FilterToSchema';
import AddFragmentsByField from './transforms/AddFragmentsByField';
import AddSelectionSetsByField from './transforms/AddSelectionSetsByField';
import AddSelectionSetsByType from './transforms/AddSelectionSetsByType';
import AddTypenameToAbstract from './transforms/AddTypenameToAbstract';
import CheckResultAndHandleErrors from './transforms/CheckResultAndHandleErrors';
import AddArgumentsAsVariables from './transforms/AddArgumentsAsVariables';
import { createRequestFromInfo, getDelegatingOperation } from './createRequest';
import { isSubschemaConfig, } from './types';
export function delegateToSchema(options) {
    if (isSchema(options)) {
        throw new Error('Passing positional arguments to delegateToSchema is deprecated. ' + 'Please pass named parameters instead.');
    }
    const { info, operation = getDelegatingOperation(info.parentType, info.schema), fieldName = info.fieldName, returnType = info.returnType, selectionSet, fieldNodes, } = options;
    const request = createRequestFromInfo({
        info,
        operation,
        fieldName,
        selectionSet,
        fieldNodes,
    });
    return delegateRequest({
        ...options,
        request,
        operation,
        fieldName,
        returnType,
    });
}
function getDelegationReturnType(info, targetSchema, operation, fieldName) {
    if (info != null) {
        return info.returnType;
    }
    let rootType;
    if (operation === 'query') {
        rootType = targetSchema.getQueryType();
    }
    else if (operation === 'mutation') {
        rootType = targetSchema.getMutationType();
    }
    else {
        rootType = targetSchema.getSubscriptionType();
    }
    return rootType.getFields()[fieldName].type;
}
function buildDelegationTransforms(subschemaOrSubschemaConfig, info, context, targetSchema, fieldName, args, returnType, transforms, transformedSchema, skipTypeMerging) {
    var _a, _b;
    const stitchingInfo = (_a = info === null || info === void 0 ? void 0 : info.schema.extensions) === null || _a === void 0 ? void 0 : _a.stitchingInfo;
    let delegationTransforms = [
        new CheckResultAndHandleErrors(info, fieldName, subschemaOrSubschemaConfig, context, returnType, skipTypeMerging),
    ];
    if (stitchingInfo != null) {
        delegationTransforms.push(new AddSelectionSetsByField(info.schema, stitchingInfo.selectionSetsByField), new AddSelectionSetsByType(info.schema, stitchingInfo.selectionSetsByType));
    }
    const transformedTargetSchema = stitchingInfo == null
        ? transformedSchema !== null && transformedSchema !== void 0 ? transformedSchema : targetSchema : (_b = transformedSchema !== null && transformedSchema !== void 0 ? transformedSchema : stitchingInfo.transformedSchemas.get(subschemaOrSubschemaConfig)) !== null && _b !== void 0 ? _b : targetSchema;
    delegationTransforms.push(new WrapConcreteTypes(returnType, transformedTargetSchema));
    if (info != null) {
        delegationTransforms.push(new ExpandAbstractTypes(info.schema, transformedTargetSchema));
    }
    delegationTransforms = delegationTransforms.concat(transforms);
    if (stitchingInfo != null) {
        delegationTransforms.push(new AddFragmentsByField(targetSchema, stitchingInfo.fragmentsByField));
    }
    if (args != null) {
        delegationTransforms.push(new AddArgumentsAsVariables(targetSchema, args));
    }
    delegationTransforms.push(new FilterToSchema(targetSchema), new AddTypenameToAbstract(targetSchema));
    return delegationTransforms;
}
export function delegateRequest({ request, schema: subschemaOrSubschemaConfig, rootValue, info, operation, fieldName, args, returnType, context, transforms = [], transformedSchema, skipValidation, skipTypeMerging, }) {
    var _a;
    let operationDefinition;
    let targetOperation;
    let targetFieldName;
    if (operation == null) {
        operationDefinition = getOperationAST(request.document, undefined);
        targetOperation = operationDefinition.operation;
    }
    else {
        targetOperation = operation;
    }
    if (fieldName == null) {
        operationDefinition = operationDefinition !== null && operationDefinition !== void 0 ? operationDefinition : getOperationAST(request.document, undefined);
        targetFieldName = operationDefinition.selectionSet.selections[0].name.value;
    }
    else {
        targetFieldName = fieldName;
    }
    let targetSchema;
    let targetRootValue;
    let requestTransforms = transforms.slice();
    let subschemaConfig;
    if (isSubschemaConfig(subschemaOrSubschemaConfig)) {
        subschemaConfig = subschemaOrSubschemaConfig;
        targetSchema = subschemaConfig.schema;
        targetRootValue = (_a = rootValue !== null && rootValue !== void 0 ? rootValue : subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.rootValue) !== null && _a !== void 0 ? _a : info === null || info === void 0 ? void 0 : info.rootValue;
        if (subschemaConfig.transforms != null) {
            requestTransforms = requestTransforms.concat(subschemaConfig.transforms);
        }
    }
    else {
        targetSchema = subschemaOrSubschemaConfig;
        targetRootValue = rootValue !== null && rootValue !== void 0 ? rootValue : info === null || info === void 0 ? void 0 : info.rootValue;
    }
    const delegationTransforms = buildDelegationTransforms(subschemaOrSubschemaConfig, info, context, targetSchema, targetFieldName, args, returnType !== null && returnType !== void 0 ? returnType : getDelegationReturnType(info, targetSchema, targetOperation, targetFieldName), requestTransforms.reverse(), transformedSchema, skipTypeMerging);
    const processedRequest = applyRequestTransforms(request, delegationTransforms);
    if (!skipValidation) {
        const errors = validate(targetSchema, processedRequest.document);
        if (errors.length > 0) {
            if (errors.length > 1) {
                const combinedError = new CombinedError(errors);
                throw combinedError;
            }
            const error = errors[0];
            throw error.originalError || error;
        }
    }
    if (targetOperation === 'query' || targetOperation === 'mutation') {
        const executor = (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.executor) || createDefaultExecutor(targetSchema, (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.rootValue) || targetRootValue);
        const executionResult = executor({
            document: processedRequest.document,
            variables: processedRequest.variables,
            context,
            info,
        });
        if (executionResult instanceof Promise) {
            return executionResult.then((originalResult) => applyResultTransforms(originalResult, delegationTransforms));
        }
        return applyResultTransforms(executionResult, delegationTransforms);
    }
    const subscriber = (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.subscriber) || createDefaultSubscriber(targetSchema, (subschemaConfig === null || subschemaConfig === void 0 ? void 0 : subschemaConfig.rootValue) || targetRootValue);
    return subscriber({
        document: processedRequest.document,
        variables: processedRequest.variables,
        context,
        info,
    }).then((subscriptionResult) => {
        if (Symbol.asyncIterator in subscriptionResult) {
            // "subscribe" to the subscription result and map the result through the transforms
            return mapAsyncIterator(subscriptionResult, result => {
                const transformedResult = applyResultTransforms(result, delegationTransforms);
                // wrap with fieldName to return for an additional round of resolutioon
                // with payload as rootValue
                return {
                    [targetFieldName]: transformedResult,
                };
            });
        }
        return applyResultTransforms(subscriptionResult, delegationTransforms);
    });
}
function createDefaultExecutor(schema, rootValue) {
    return ({ document, context, variables, info }) => execute({
        schema,
        document,
        contextValue: context,
        variableValues: variables,
        rootValue: rootValue !== null && rootValue !== void 0 ? rootValue : info === null || info === void 0 ? void 0 : info.rootValue,
    });
}
function createDefaultSubscriber(schema, rootValue) {
    return ({ document, context, variables, info }) => subscribe({
        schema,
        document,
        contextValue: context,
        variableValues: variables,
        rootValue: rootValue !== null && rootValue !== void 0 ? rootValue : info === null || info === void 0 ? void 0 : info.rootValue,
    });
}
//# sourceMappingURL=delegateToSchema.js.map