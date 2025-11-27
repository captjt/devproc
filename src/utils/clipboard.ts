import { spawn } from "bun"

/**
 * Copy text to the system clipboard
 * Works on macOS (pbcopy) and Linux (xclip/xsel)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const platform = process.platform

  try {
    if (platform === "darwin") {
      // macOS
      const proc = spawn({
        cmd: ["pbcopy"],
        stdin: "pipe",
      })
      proc.stdin.write(text)
      proc.stdin.end()
      await proc.exited
      return true
    } else if (platform === "linux") {
      // Try xclip first, then xsel
      try {
        const proc = spawn({
          cmd: ["xclip", "-selection", "clipboard"],
          stdin: "pipe",
        })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited
        return true
      } catch {
        // Try xsel as fallback
        const proc = spawn({
          cmd: ["xsel", "--clipboard", "--input"],
          stdin: "pipe",
        })
        proc.stdin.write(text)
        proc.stdin.end()
        await proc.exited
        return true
      }
    } else if (platform === "win32") {
      // Windows - use clip.exe
      const proc = spawn({
        cmd: ["clip"],
        stdin: "pipe",
      })
      proc.stdin.write(text)
      proc.stdin.end()
      await proc.exited
      return true
    }
  } catch {
    // Clipboard command failed
    return false
  }

  return false
}
