import { concat } from 'apollo-link';
import { createUploadLink, formDataAppendFile, isExtractableFile } from 'apollo-upload-client';
import FormData from 'form-data';
import { fetch } from 'cross-fetch';
import { AwaitVariablesLink } from './AwaitVariablesLink';
class FormDataWithStreamSupport extends FormData {
    constructor(options) {
        super(options);
        this.hasUnknowableLength = false;
    }
    append(key, value, optionsOrFilename = {}) {
        // allow filename as single option
        const options = typeof optionsOrFilename === 'string' ? { filename: optionsOrFilename } : optionsOrFilename;
        // empty or either doesn't have path or not an http response
        if (!options.knownLength &&
            !Buffer.isBuffer(value) &&
            typeof value !== 'string' &&
            !value.path &&
            !(value.readable && 'httpVersion' in value)) {
            this.hasUnknowableLength = true;
        }
        super.append(key, value, options);
    }
    getLength(callback) {
        if (this.hasUnknowableLength) {
            return null;
        }
        return super.getLength(callback);
    }
    getLengthSync() {
        if (this.hasUnknowableLength) {
            return null;
        }
        // eslint-disable-next-line no-sync
        return super.getLengthSync();
    }
}
export const createServerHttpLink = (options) => concat(new AwaitVariablesLink(), createUploadLink({
    ...options,
    fetch,
    FormData: FormDataWithStreamSupport,
    isExtractableFile: (value) => isExtractableFile(value) || (value === null || value === void 0 ? void 0 : value.createReadStream),
    formDataAppendFile: (form, index, file) => {
        if (file.createReadStream != null) {
            form.append(index, file.createReadStream(), {
                filename: file.filename,
                contentType: file.mimetype,
            });
        }
        else {
            formDataAppendFile(form, index, file);
        }
    },
}));
//# sourceMappingURL=createServerHttpLink.js.map