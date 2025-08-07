import { describe, Mock, afterEach, vi, it, expect } from "vitest";
import { getUserConfirmation } from "./userConfirmation";
import prompt from "prompts";

vi.mock("prompts", () => ({
  default: vi.fn(),
}));

describe("getUserConfirmation", () => {
  const mockPrompt = prompt as unknown as Mock;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true if yes option is passed", async () => {
    const result = await getUserConfirmation({ yes: true });
    expect(result).toBe(true);
  });

  it("returns true if user confirms", async () => {
    mockPrompt.mockResolvedValue({ yes: true });
    const result = await getUserConfirmation({ yes: false });
    expect(result).toBe(true);
  });

  it("returns false if user declines", async () => {
    mockPrompt.mockResolvedValue({ yes: false });
    const result = await getUserConfirmation({ yes: false });
    expect(result).toBe(false);
  });
});
