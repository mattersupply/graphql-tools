import { parse, print } from 'graphql';
import { compareNodes } from '@graphql-tools/utils';
function sortRecursive(a) {
    for (const attr in a) {
        if (a[attr] instanceof Array) {
            if (a[attr].length === 1) {
                sortRecursive(a[attr][0]);
            }
            a[attr].sort((b, c) => {
                sortRecursive(b);
                sortRecursive(c);
                return compareNodes(b, c);
            });
        }
    }
}
function normalizeDocumentString(docStr) {
    const doc = parse(docStr, { noLocation: true });
    sortRecursive(doc);
    return print(doc);
}
expect.extend({
    toBeSimilarGqlDoc(received, expected) {
        const strippedReceived = normalizeDocumentString(received);
        const strippedExpected = normalizeDocumentString(expected);
        if (strippedReceived.trim() === strippedExpected.trim()) {
            return {
                message: () => `expected
       ${received}
       not to be a string containing (ignoring indents)
       ${expected}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected
       ${received}
       to be a string containing (ignoring indents)
       ${expected}`,
                pass: false,
            };
        }
    },
});
//# sourceMappingURL=to-be-similar-gql-doc.js.map