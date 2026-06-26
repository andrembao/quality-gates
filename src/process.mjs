import { spawn } from "node:child_process";

export function runCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: ["inherit", "pipe", "pipe"] });
    let output = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      output += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        output
      });
    });
  });
}
