import { describe, it, expect } from "@jest/globals";
import { parseCLIOutput } from "../../../docs/test/docs.cli.helper";

describe("parseCLIOutput", () => {
  describe("when parsing CLI output with both options and commands", () => {
    const sampleOutput = `
    Usage: pepr [options] [command]

    Type safe K8s middleware for humans

    Options:
      -V, --version          output the version number
      -h, --help             display help for command

    Commands:
      init [options]         Initialize a new Pepr Module
      build [options]        Build a Pepr Module for deployment
      deploy [options]       Deploy a Pepr Module
    `;

    it("should extract all options", () => {
      const result = parseCLIOutput(sampleOutput);

      expect(result.options).toHaveLength(2);
      expect(result.options).toContain("-V, --version          output the version number");
      expect(result.options).toContain("-h, --help             display help for command");
    });

    it("should extract all commands", () => {
      const result = parseCLIOutput(sampleOutput);

      expect(result.commands).toHaveLength(3);
      expect(result.commands).toContain("init [options]         Initialize a new Pepr Module");
      expect(result.commands).toContain(
        "build [options]        Build a Pepr Module for deployment",
      );
      expect(result.commands).toContain("deploy [options]       Deploy a Pepr Module");
    });
  });

  describe("when parsing CLI output with only options", () => {
    const optionsOnlyOutput = `
    Usage: pepr uuid [options]

    Module UUID(s) currently deployed in the cluster

    Options:
      -h, --help             display help for command
    `;

    it("should extract options but no commands", () => {
      const result = parseCLIOutput(optionsOnlyOutput);

      expect(result.options).toHaveLength(1);
      expect(result.options).toContain("-h, --help             display help for command");
      expect(result.commands).toHaveLength(0);
    });
  });

  describe("when parsing CLI output with only commands", () => {
    const commandsOnlyOutput = `
    Usage: pepr crd [options] [command]

    Scaffold and generate Kubernetes CRDs

    Commands:
      create [options]       Create a new CRD TypeScript definition
      generate [options]     Generate CRD manifests from TypeScript definitions
      help [command]         display help for command
    `;

    it("should extract commands but no options", () => {
      const result = parseCLIOutput(commandsOnlyOutput);

      expect(result.commands).toHaveLength(3);
      expect(result.options).toHaveLength(0);
    });
  });

  describe("when parsing CLI output with multiline command descriptions", () => {
    const multilineOutput = `
    Usage: pepr [options] [command]

    Type safe K8s middleware for humans

    Options:
      -V, --version          output the version number
      -h, --help             display help for command

    Commands:
      init [options]         Initialize a new Pepr Module
      update [options]       Update this Pepr module. Not recommended for prod as it
                             may change files.
      format [options]       Lint and format this Pepr module
    `;

    it("should properly handle multiline command descriptions", () => {
      const result = parseCLIOutput(multilineOutput);

      expect(result.commands).toHaveLength(3);
      expect(result.commands).toContain("init [options]         Initialize a new Pepr Module");
      expect(result.commands).toContain(
        "update [options]       Update this Pepr module. Not recommended for prod as it may change files.",
      );
      expect(result.commands).toContain("format [options]       Lint and format this Pepr module");
    });
  });

  describe("when parsing empty CLI output", () => {
    it("should return empty arrays", () => {
      const result = parseCLIOutput("");

      expect(result.options).toHaveLength(0);
      expect(result.commands).toHaveLength(0);
    });
  });
});
