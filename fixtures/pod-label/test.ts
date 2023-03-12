export function transform(json: string) {
  const resource = JSON.parse(json);

  resource.metadata.labels["example"] = "test-value";

  console.log("LOG FROM V8")

  return JSON.stringify(resource);
}
