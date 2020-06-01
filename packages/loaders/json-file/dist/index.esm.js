import { isValidPath, parseGraphQLJSON } from '@graphql-tools/utils';
import { isAbsolute, resolve } from 'path';
import { exists, existsSync, readFile, readFileSync } from 'fs-extra';
import { cwd } from 'process';

const FILE_EXTENSIONS = ['.json'];
class JsonFileLoader {
    loaderId() {
        return 'json-file';
    }
    async canLoad(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
                return new Promise(resolve => exists(normalizedFilePath, resolve));
            }
        }
        return false;
    }
    canLoadSync(pointer, options) {
        if (isValidPath(pointer)) {
            if (FILE_EXTENSIONS.find(extension => pointer.endsWith(extension))) {
                const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
                if (existsSync(normalizedFilePath)) {
                    return true;
                }
            }
        }
        return false;
    }
    async load(pointer, options) {
        const normalizedFilePath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
        try {
            const jsonContent = await readFile(normalizedFilePath, { encoding: 'utf8' });
            return parseGraphQLJSON(pointer, jsonContent, options);
        }
        catch (e) {
            throw new Error(`Unable to read JSON file: ${normalizedFilePath}: ${e.message || e}`);
        }
    }
    loadSync(pointer, options) {
        const normalizedFilepath = isAbsolute(pointer) ? pointer : resolve(options.cwd || cwd(), pointer);
        try {
            const jsonContent = readFileSync(normalizedFilepath, 'utf8');
            return parseGraphQLJSON(pointer, jsonContent, options);
        }
        catch (e) {
            throw new Error(`Unable to read JSON file: ${normalizedFilepath}: ${e.message || e}`);
        }
    }
}

export { JsonFileLoader };
//# sourceMappingURL=index.esm.js.map
