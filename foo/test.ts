function tranform(json: string) {
  const resource = JSON.parse(json);
  console.log(resource);

  resource.metadata.labels["example"] = "test-value";

  return JSON.stringify(resource);
}
