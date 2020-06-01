import { Kind, validate, specifiedRules, } from 'graphql';
import { CombinedError } from './errors';
const DEFAULT_EFFECTIVE_RULES = createDefaultRules();
export async function validateGraphQlDocuments(schema, documentFiles, effectiveRules = DEFAULT_EFFECTIVE_RULES) {
    const allFragments = [];
    documentFiles.forEach(documentFile => {
        if (documentFile.document) {
            for (const definitionNode of documentFile.document.definitions) {
                if (definitionNode.kind === Kind.FRAGMENT_DEFINITION) {
                    allFragments.push(definitionNode);
                }
            }
        }
    });
    const allErrors = [];
    await Promise.all(documentFiles.map(async (documentFile) => {
        const documentToValidate = {
            kind: Kind.DOCUMENT,
            definitions: [...allFragments, ...documentFile.document.definitions].filter((definition, index, list) => {
                if (definition.kind === Kind.FRAGMENT_DEFINITION) {
                    const firstIndex = list.findIndex(def => def.kind === Kind.FRAGMENT_DEFINITION && def.name.value === definition.name.value);
                    const isDuplicated = firstIndex !== index;
                    if (isDuplicated) {
                        return false;
                    }
                }
                return true;
            }),
        };
        const errors = validate(schema, documentToValidate, effectiveRules);
        if (errors.length > 0) {
            allErrors.push({
                filePath: documentFile.location,
                errors,
            });
        }
    }));
    return allErrors;
}
export function checkValidationErrors(loadDocumentErrors) {
    if (loadDocumentErrors.length > 0) {
        const errors = [];
        for (const loadDocumentError of loadDocumentErrors) {
            for (const graphQLError of loadDocumentError.errors) {
                const error = new Error();
                error.name = 'GraphQLDocumentError';
                error.message = `${error.name}: ${graphQLError.message}`;
                error.stack = error.message;
                graphQLError.locations.forEach(location => (error.stack += `\n    at ${loadDocumentError.filePath}:${location.line}:${location.column}`));
                errors.push(error);
            }
        }
        throw new CombinedError(errors);
    }
}
function createDefaultRules() {
    const ignored = ['NoUnusedFragmentsRule', 'NoUnusedVariablesRule', 'KnownDirectivesRule'];
    // GraphQL v14 has no Rule suffix in function names
    // Adding `*Rule` makes validation backwards compatible
    ignored.forEach(rule => {
        ignored.push(rule.replace(/Rule$/, ''));
    });
    return specifiedRules.filter((f) => !ignored.includes(f.name));
}
//# sourceMappingURL=validate-documents.js.map