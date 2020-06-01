import { toPromise, execute } from 'apollo-link';
export const linkToExecutor = (link) => ({ document, variables, context, info, }) => toPromise(execute(link, {
    query: document,
    variables,
    context: {
        graphqlContext: context,
        graphqlResolveInfo: info,
    },
}));
//# sourceMappingURL=linkToExecutor.js.map