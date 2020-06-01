import { parse, Kind, Source as GraphQLSource } from 'graphql';
export function parseGraphQLSDL(location, rawSDL, options) {
    let document;
    try {
        document = parse(new GraphQLSource(rawSDL, location), options);
    }
    catch (e) {
        if (e.message.includes('EOF')) {
            document = {
                kind: Kind.DOCUMENT,
                definitions: [],
            };
        }
        else {
            throw e;
        }
    }
    return {
        location,
        document,
        rawSDL,
    };
}
//# sourceMappingURL=parse-graphql-sdl.js.map