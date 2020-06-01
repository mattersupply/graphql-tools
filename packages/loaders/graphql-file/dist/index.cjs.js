'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const utils = require('@graphql-tools/utils');
const path = require('path');
const fsExtra = require('fs-extra');
const process = require('process');
const _import = require('@graphql-tools/import');

const FILE_EXTENSIONS = ['.gql', '.gqls', '.graphql', '.graphqls'];
function isGraphQLImportFile(rawSDL) {
    const trimmedRawSDL = rawSDL.trim();
    return trimmedRawSDL.startsWith('# import') || trimmedRawSDL.startsWith('#import');
}
class GraphQLFileLoader {
    loaderId() {
        return 'graphql-file';
    }
    async canLoad(pointer, options) {
        if (utils.isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = path.isAbsolute(pointer) ? pointer : path.resolve(options.cwd, pointer);
                return new Promise(resolve => fsExtra.exists(normalizedFilePath, resolve));
            }
        }
        return false;
    }
    canLoadSync(pointer, options) {
        if (utils.isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = path.isAbsolute(pointer) ? pointer : path.resolve(options.cwd, pointer);
                return fsExtra.existsSync(normalizedFilePath);
            }
        }
        return false;
    }
    async load(pointer, options) {
        const normalizedFilePath = path.isAbsolute(pointer) ? pointer : path.resolve(options.cwd, pointer);
        const rawSDL = await fsExtra.readFile(normalizedFilePath, { encoding: 'utf8' });
        if (isGraphQLImportFile(rawSDL)) {
            return {
                location: pointer,
                document: _import.processImport(pointer, options.cwd),
            };
        }
        return utils.parseGraphQLSDL(pointer, rawSDL.trim(), options);
    }
    loadSync(pointer, options) {
        const cwd = options.cwd || process.cwd();
        const normalizedFilePath = path.isAbsolute(pointer) ? pointer : path.resolve(cwd, pointer);
        const rawSDL = fsExtra.readFileSync(normalizedFilePath, { encoding: 'utf8' });
        if (isGraphQLImportFile(rawSDL)) {
            return {
                location: pointer,
                document: _import.processImport(pointer, options.cwd),
            };
        }
        return utils.parseGraphQLSDL(pointer, rawSDL.trim(), options);
    }
}

exports.GraphQLFileLoader = GraphQLFileLoader;
//# sourceMappingURL=index.cjs.js.map