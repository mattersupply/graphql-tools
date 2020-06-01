// Abstract base class of any visitor implementation, defining the available
// visitor methods along with their parameter types, and providing a static
// helper function for determining whether a subclass implements a given
// visitor method, as opposed to inheriting one of the stubs defined here.
export class SchemaVisitor {
    // Determine if this SchemaVisitor (sub)class implements a particular
    // visitor method.
    static implementsVisitorMethod(methodName) {
        if (!methodName.startsWith('visit')) {
            return false;
        }
        const method = this.prototype[methodName];
        if (typeof method !== 'function') {
            return false;
        }
        if (this.name === 'SchemaVisitor') {
            // The SchemaVisitor class implements every visitor method.
            return true;
        }
        const stub = SchemaVisitor.prototype[methodName];
        if (method === stub) {
            // If this.prototype[methodName] was just inherited from SchemaVisitor,
            // then this class does not really implement the method.
            return false;
        }
        return true;
    }
    // Concrete subclasses of SchemaVisitor should override one or more of these
    // visitor methods, in order to express their interest in handling certain
    // schema types/locations. Each method may return null to remove the given
    // type from the schema, a non-null value of the same type to update the
    // type in the schema, or nothing to leave the type as it was.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    visitSchema(_schema) { }
    visitScalar(_scalar
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
    visitObject(_object
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
    visitFieldDefinition(_field, _details
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
    visitArgumentDefinition(_argument, _details
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
    visitInterface(_iface
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    visitUnion(_union) { }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    visitEnum(_type) { }
    visitEnumValue(_value, _details
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
    visitInputObject(_object
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
    visitInputFieldDefinition(_field, _details
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    ) { }
}
//# sourceMappingURL=SchemaVisitor.js.map