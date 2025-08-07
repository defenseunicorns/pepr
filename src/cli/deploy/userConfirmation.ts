import prompt from "prompts";

export async function getUserConfirmation(opts: { yes: boolean }): Promise<boolean> {
  if (opts.yes) {
    return true;
  }

  // Prompt the user to confirm
  const confirmation = await prompt({
    type: "confirm",
    name: "yes",
    message: "This will remove and redeploy the module. Continue?",
  });

  return confirmation.yes ? true : false;
}
