// const matrixList = ['package-a', 'package-b', 'package-c'].map((pkg) => ({
//   package: pkg,
// }));

// const includeStatement = { include: matrixList };
// console.log(`::set-output name=matrix::${JSON.stringify(includeStatement)}`);

const examples = {
  include: [{
    nickname: "nick-example-a",
    package: "pack-example-a"
  },{
    nickname: "nick-example-b",
    package: "pack-example-b"
  }]
}

console.log(`::set-output name=matrix::${JSON.stringify(examples)}`);