'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const utils = require('@graphql-tools/utils');
const path = require('path');
const fsExtra = require('fs-extra');
const process = require('process');

const FILE_EXTENSIONS = ['.json'];
class JsonFileLoader {
    loaderId() {
        return 'json-file';
    }
    async canLoad(pointer, options) {
        if (utils.isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = path.isAbsolute(pointer) ? pointer : path.resolve(options.cwd || process.cwd(), pointer);
                return new Promise(resolve => fsExtra.exists(normalizedFilePath, resolve));
            }
        }
        return false;
    }
    canLoadSync(pointer, options) {
        if (utils.isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = path.isAbsolute(pointer) ? pointer : path.resolve(options.cwd || process.cwd(), pointer);
                if (fsExtra.existsSync(normalizedFilePath)) {
                    return true;
                }
            }
        }
        return false;
    }
    async load(pointer, options) {
        const normalizedFilePath = path.isAbsolute(pointer) ? pointer : path.resolve(options.cwd || process.cwd(), pointer);
        try {
            const jsonContent = await fsExtra.readFile(normalizedFilePath, { encoding: 'utf8' });
            return utils.parseGraphQLJSON(pointer, jsonContent, options);
        }
        catch (e) {
            throw new Error(`Unable to read JSON file: ${normalizedFilePath}: ${e.message || e}`);
        }
    }
    loadSync(pointer, options) {
        const normalizedFilepath = path.isAbsolute(pointer) ? pointer : path.resolve(options.cwd || process.cwd(), pointer);
        try {
            const jsonContent = fsExtra.readFileSync(normalizedFilepath, 'utf8');
            return utils.parseGraphQLJSON(pointer, jsonContent, options);
        }
        catch (e) {
            throw new Error(`Unable to read JSON file: ${normalizedFilepath}: ${e.message || e}`);
        }
    }
}

exports.JsonFileLoader = JsonFileLoader;
//# sourceMappingURL=index.cjs.js.map
