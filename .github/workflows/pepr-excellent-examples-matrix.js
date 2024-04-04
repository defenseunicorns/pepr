const matrixList = ['package-a', 'package-b', 'package-c'].map((pkg) => ({
  package: pkg,
}));

const includeStatement = { include: matrixList };
console.log(`::set-output name=matrix::${JSON.stringify(includeStatement)}`);