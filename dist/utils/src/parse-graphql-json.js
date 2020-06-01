import { buildClientSchema, parse } from 'graphql';
import { printSchemaWithDirectives } from './print-schema-with-directives';
function stripBOM(content) {
    content = content.toString();
    // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
    // because the buffer-to-string conversion in `fs.readFileSync()`
    // translates it to FEFF, the UTF-16 BOM.
    if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
    }
    return content;
}
function parseBOM(content) {
    return JSON.parse(stripBOM(content));
}
export function parseGraphQLJSON(location, jsonContent, options) {
    let parsedJson = parseBOM(jsonContent);
    if (parsedJson.data) {
        parsedJson = parsedJson.data;
    }
    if (parsedJson.kind === 'Document') {
        const document = parsedJson;
        return {
            location,
            document,
        };
    }
    else if (parsedJson.__schema) {
        const schema = buildClientSchema(parsedJson, options);
        const rawSDL = printSchemaWithDirectives(schema, options);
        return {
            location,
            document: parse(rawSDL, options),
            rawSDL,
            schema,
        };
    }
    throw new Error(`Not valid JSON content`);
}
//# sourceMappingURL=parse-graphql-json.js.map