import { execute } from 'apollo-link';
import { observableToAsyncIterable } from '@graphql-tools/utils';
export const linkToSubscriber = (link) => async ({ document, variables, context, info, }) => observableToAsyncIterable(execute(link, {
    query: document,
    variables,
    context: {
        graphqlContext: context,
        graphqlResolveInfo: info,
    },
}));
//# sourceMappingURL=linkToSubscriber.js.map