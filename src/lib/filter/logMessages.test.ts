import { expect, it } from "@jest/globals";
import { commonLogMessage } from "./logMessages";

it("should display the default log message when the subject is unsupported", () => {
  const result = commonLogMessage("not-supported", ["some input"], ["some criteria"]);
  expect(result).toMatch(
    /Ignoring Admission Callback: An undefined logging condition occurred. Filter input was '.*' and Filter criteria was '.*'/,
  );
});
