import { execute, parse } from 'graphql';
import { resolve } from 'path';
import { existsSync } from 'fs';
import nock from 'nock';
import { cwd } from 'process';
export function runTests({ sync: executeSync, async: executeAsync }) {
    return (testRunner) => {
        if (executeSync) {
            // sync
            describe('sync', () => {
                testRunner((...args) => {
                    return new Promise((resolve, reject) => {
                        try {
                            const result = executeSync(...args);
                            resolve(result);
                        }
                        catch (error) {
                            reject(error);
                        }
                    });
                }, 'sync');
            });
        }
        if (executeAsync) {
            // async
            describe(`async`, () => {
                testRunner((...args) => executeAsync(...args), 'async');
            });
        }
    };
}
export function useMonorepo({ dirname }) {
    const cwd = findProjectDir(dirname);
    return {
        correctCWD() {
            let spyProcessCwd;
            beforeEach(() => {
                spyProcessCwd = jest.spyOn(process, 'cwd').mockReturnValue(cwd);
            });
            afterEach(() => {
                spyProcessCwd.mockRestore();
            });
        },
    };
}
function findProjectDir(dirname) {
    const originalDirname = dirname;
    const stopDir = resolve(cwd(), '..');
    while (dirname !== stopDir) {
        try {
            if (existsSync(resolve(dirname, 'package.json'))) {
                return dirname;
            }
            dirname = resolve(dirname, '..');
        }
        catch (e) {
            // ignore
        }
    }
    throw new Error(`Coudn't find project's root from: ${originalDirname}`);
}
export function mockGraphQLServer({ schema, host, path, intercept, }) {
    return nock(host)
        .post(path)
        .reply(async function (_, body) {
        try {
            if (intercept) {
                intercept(this);
            }
            const result = await execute({
                schema,
                document: parse(body.query),
                operationName: body.operationName,
                variableValues: body.variables,
            });
            return [200, result];
        }
        catch (error) {
            return [500, error];
        }
    });
}
//# sourceMappingURL=utils.js.map