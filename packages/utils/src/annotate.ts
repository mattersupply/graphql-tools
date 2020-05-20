import { GraphQLNamedType, isObjectType } from 'graphql';

export function annotateType<T extends GraphQLNamedType>(newType: T, originalType: T): T {
  const symbols = Object.getOwnPropertySymbols(originalType);
  symbols.forEach(symbol => {
    newType[symbol] = originalType[symbol];
  });

  if (isObjectType(newType)) {
    const names = Object.getOwnPropertyNames(originalType);
    const objectPropertyNames = ['name', 'description', 'isTypeOf', 'extensions', 'astNode', 'extensionASTNodes'];
    names.forEach(name => {
      if (!objectPropertyNames.includes(name) && !name.startsWith('_')) {
        newType[name] = originalType[name];
      }
    });
  }
  return newType;
}
