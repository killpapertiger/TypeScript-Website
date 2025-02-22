import { Sandbox } from "typescriptlang-org/static/js/sandbox"

export const createTwoslashInlayProvider = (sandbox: Sandbox) => {
  const provider: import("monaco-editor").languages.InlayHintsProvider = {
    provideInlayHints: async (model, _, cancel) => {
      const text = model.getValue()
      const queryRegex = /^\s*\/\/\s*\^\?$/gm
      let match
      const results: import("monaco-editor").languages.InlayHint[] = []
      const worker = await sandbox.getWorkerProcess()
      if (model.isDisposed()) {
        return []
      }

      while ((match = queryRegex.exec(text)) !== null) {
        const end = match.index + match[0].length - 1
        const endPos = model.getPositionAt(end)
        const inspectionPos = new sandbox.monaco.Position(endPos.lineNumber - 1, endPos.column)
        const inspectionOff = model.getOffsetAt(inspectionPos)

        if (cancel.isCancellationRequested) return []

        const hint = await worker.getQuickInfoAtPosition("file://" + model.uri.path, inspectionOff)
        if (!hint || !hint.displayParts) continue

        const inlay: import("monaco-editor").languages.InlayHint = {
          // @ts-ignore
          kind: 0,
          position: new sandbox.monaco.Position(endPos.lineNumber, endPos.column + 1),
          text: hint.displayParts.map(d => d.text).join(""),
          whitespaceBefore: true,
        }
        results.push(inlay)
      }
      return results
    },
  }
  return provider
}
