{ pkgs ? import <nixpkgs> {}, }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs-18_x # Ensure you're using Node.js version 18.x
    pkgs.docker      # Docker for container management
    pkgs.kubectl     # kubectl for interacting with Kubernetes clusters
    pkgs.git         # Git for version control
    pkgs.jq          # jq for processing JSON
    pkgs.yarn        # Yarn for managing Node.js dependencies
  ];

  shellHook = ''
    echo "Environment ready. Node.js version: $(node --version)"
    echo "Remember to run 'yarn install' to install project dependencies."
  '';
}
