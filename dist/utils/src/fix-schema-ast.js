import { buildSchema } from 'graphql';
import { printSchemaWithDirectives } from './print-schema-with-directives';
function buildFixedSchema(schema, options) {
    return buildSchema(printSchemaWithDirectives(schema, options), {
        noLocation: true,
        ...(options || {}),
    });
}
export function fixSchemaAst(schema, options) {
    let schemaWithValidAst;
    if (!schema.astNode) {
        Object.defineProperty(schema, 'astNode', {
            get() {
                if (!schemaWithValidAst) {
                    schemaWithValidAst = buildFixedSchema(schema, options);
                }
                return schemaWithValidAst.astNode;
            },
        });
    }
    if (!schema.extensionASTNodes) {
        Object.defineProperty(schema, 'extensionASTNodes', {
            get() {
                if (!schemaWithValidAst) {
                    schemaWithValidAst = buildFixedSchema(schema, options);
                }
                return schemaWithValidAst.extensionASTNodes;
            },
        });
    }
    return schema;
}
//# sourceMappingURL=fix-schema-ast.js.map