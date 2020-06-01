declare global {
    namespace jest {
        interface Matchers<R, T> {
            /**
             * Normalizes whitespace and performs string comparisons
             */
            toBeSimilarGqlDoc(expected: string): R;
        }
    }
}
export {};
