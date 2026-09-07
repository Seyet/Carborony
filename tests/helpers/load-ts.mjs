import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { runInThisContext } from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)

// Compile the real server modules with only their external boundaries replaced.
// This keeps the tests independent of Next's request context and hosted Auth.
export function loadTs(path, dependencies = {}) {
  const filename = resolve(path)
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  })
  const compiledModule = { exports: {} }
  const localRequire = (name) => {
    if (name === "server-only") return {}
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    return require(name)
  }
  runInThisContext(`(function(require, module, exports) {${outputText}\n})`, { filename })(
    localRequire, compiledModule, compiledModule.exports,
  )
  return compiledModule.exports
}

