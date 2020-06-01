import { visit, Kind } from 'graphql';
import { relocatedError } from '@graphql-tools/utils';
export default class TransformQuery {
    constructor({ path, queryTransformer, resultTransformer = result => result, errorPathTransformer = errorPath => [].concat(errorPath), fragments = {}, }) {
        this.path = path;
        this.queryTransformer = queryTransformer;
        this.resultTransformer = resultTransformer;
        this.errorPathTransformer = errorPathTransformer;
        this.fragments = fragments;
    }
    transformRequest(originalRequest) {
        const document = originalRequest.document;
        const pathLength = this.path.length;
        let index = 0;
        const newDocument = visit(document, {
            [Kind.FIELD]: {
                enter: node => {
                    if (index === pathLength || node.name.value !== this.path[index]) {
                        return false;
                    }
                    index++;
                    if (index === pathLength) {
                        const selectionSet = this.queryTransformer(node.selectionSet, this.fragments);
                        return {
                            ...node,
                            selectionSet,
                        };
                    }
                },
                leave: () => {
                    index--;
                },
            },
        });
        return {
            ...originalRequest,
            document: newDocument,
        };
    }
    transformResult(originalResult) {
        const data = this.transformData(originalResult.data);
        const errors = originalResult.errors;
        return {
            data,
            errors: errors != null ? this.transformErrors(errors) : undefined,
        };
    }
    transformData(data) {
        const leafIndex = this.path.length - 1;
        let index = 0;
        let newData = data;
        if (newData) {
            let next = this.path[index];
            while (index < leafIndex) {
                if (data[next]) {
                    newData = newData[next];
                }
                else {
                    break;
                }
                index++;
                next = this.path[index];
            }
            newData[next] = this.resultTransformer(newData[next]);
        }
        return newData;
    }
    transformErrors(errors) {
        return errors.map(error => {
            const path = error.path;
            let match = true;
            let index = 0;
            while (index < this.path.length) {
                if (path[index] !== this.path[index]) {
                    match = false;
                    break;
                }
                index++;
            }
            const newPath = match ? path.slice(0, index).concat(this.errorPathTransformer(path.slice(index))) : path;
            return relocatedError(error, newPath);
        });
    }
}
//# sourceMappingURL=TransformQuery.js.map