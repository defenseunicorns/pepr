// const examples = {
//   include: [{
//     nickname: "nick-example-a",
//     package: "pack-example-a"
//   },{
//     nickname: "nick-example-b",
//     package: "pack-example-b"
//   }]
// }

// console.log(`::set-output name=matrix::${JSON.stringify(examples)}`);


const examples = {
  include: [{
    nickname: "nick-example-a",
    package: "pack-example-a"
  },{
    nickname: "nick-example-b",
    package: "pack-example-b"
  }]
}

console.log( JSON.stringify(examples) );