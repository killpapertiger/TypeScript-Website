type StoryContent =
  | { type: "html"; html: string; title: string }
  | { type: "code"; code: string; params: string; title: string }
  | { type: "hr" }

import type { Sandbox } from "typescriptlang-org/static/js/sandbox"
import type { UI } from "./createUI"

export const gistPoweredNavBar = (sandbox: Sandbox, ui: UI, showNav: () => void) => {
  const gistHash = location.hash.split("#gist/")[1]
  const [gistID, gistStoryIndex] = gistHash.split("-")

  // @ts-ignore
  window.appInsights && window.appInsights.trackEvent({ name: "Loaded Gist Playground", properties: { id: gistID } })

  sandbox.editor.updateOptions({ readOnly: true })
  ui.flashInfo(`Opening Gist ${gistID} as a Docset`, 2000)

  const playground = document.getElementById("playground-container")!
  playground.style.opacity = "0.5"

  const setCode = (code: string) => {
    const story = document.getElementById("story-container")
    if (story) story.style.display = "none"

    const toolbar = document.getElementById("editor-toolbar")
    if (toolbar) toolbar.style.display = "block"

    const monaco = document.getElementById("monaco-editor-embed")
    if (monaco) monaco.style.display = "block"

    sandbox.setText(code)
    sandbox.editor.layout()
  }

  const setStory = (html: string) => {
    const toolbar = document.getElementById("editor-toolbar")
    if (toolbar) toolbar.style.display = "none"

    const monaco = document.getElementById("monaco-editor-embed")
    if (monaco) monaco.style.display = "none"

    const story = document.getElementById("story-container")
    if (!story) return

    story.style.display = "block"
    story.innerHTML = html
    // We need to hijack internal links
    for (const a of Array.from(story.getElementsByTagName("a"))) {
      if (!a.pathname.startsWith("/play")) continue
      // Note the the header generated links also count in here

      // overwrite playground links
      if (a.hash.includes("#code/")) {
        a.onclick = e => {
          const code = a.hash.replace("#code/", "").trim()
          let userCode = sandbox.lzstring.decompressFromEncodedURIComponent(code)
          // Fallback incase there is an extra level of decoding:
          // https://gitter.im/Microsoft/TypeScript?at=5dc478ab9c39821509ff189a
          if (!userCode) userCode = sandbox.lzstring.decompressFromEncodedURIComponent(decodeURIComponent(code))
          if (userCode) setCode(userCode)

          e.preventDefault()

          const alreadySelected = document.getElementById("navigation-container")!.querySelector("li.selected") as HTMLElement
          if (alreadySelected) alreadySelected.classList.remove("selected")
          return false
        }
      }

      // overwrite gist links
      else if (a.hash.includes("#gist/")) {
        a.onclick = e => {
          const index = Number(a.hash.split("-")[1])
          const nav = document.getElementById("navigation-container")
          if (!nav) return
          const ul = nav.getElementsByTagName("ul").item(0)!

          const targetedLi = ul.children.item(Number(index) || 0) || ul.children.item(0)
          if (targetedLi) {
            const a = targetedLi.getElementsByTagName("a").item(0)
            // @ts-ignore
            if (a) a.click()
          }
          e.preventDefault()
          return false
        }
      } else {
        a.setAttribute("target", "_blank")
      }
    }
  }

  // const relay = "http://localhost:7071/api/API"
  const relay = "https://typescriptplaygroundgistproxyapi.azurewebsites.net/api/API"
  fetch(`${relay}?gistID=${gistID}`)
    .then(async res => {
      playground.style.opacity = "1"
      sandbox.editor.updateOptions({ readOnly: false })

      const response = await res.json()
      if ("error" in response) {
        return ui.flashInfo(`Error with getting your gist: ${response.display}.`, 3000)
      }

      // If the API response is a single code file, just throw that in
      if (response.type === "code") {
        sandbox.setText(response.code)
        sandbox.setCompilerSettings(response.params)

        // If it's multi-file, then there's work to do
      } else if (response.type === "story") {
        showNav()

        const nav = document.getElementById("navigation-container")
        if (!nav) return

        const title = document.createElement("h4")
        title.textContent = response.title
        nav.appendChild(title)

        // Make all the sidebar elements
        const ul = document.createElement("ul")
        response.files.forEach((element: StoryContent, i: number) => {
          const li = document.createElement("li")
          switch (element.type) {
            case "html":
            case "code": {
              li.classList.add("selectable")
              const a = document.createElement("a")

              let logo: string
              if (element.type === "code") {
                logo = `<svg width="7" height="7" viewBox="0 0 7 7" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="7" height="7" fill="#187ABF"/></svg>`
              } else if (element.type === "html") {
                logo = `<svg width="9" height="11" viewBox="0 0 9 11" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 5.5V3.25L6 1H4M8 5.5V10H1V1H4M8 5.5H4V1" stroke="#C4C4C4"/></svg>`
              } else {
                logo = ""
              }

              a.innerHTML = `${logo}${element.title}`
              a.href = `/play?#gist/${gistID}-${i}`

              a.onclick = e => {
                e.preventDefault()

                const ed = sandbox.editor.getDomNode()
                if (!ed) return
                sandbox.editor.updateOptions({ readOnly: false })
                const alreadySelected = ul.querySelector(".selected") as HTMLElement
                if (alreadySelected) alreadySelected.classList.remove("selected")

                li.classList.add("selected")
                if (element.type === "code") {
                  setCode(element.code)
                } else if (element.type === "html") {
                  setStory(element.html)
                }

                const alwaysUpdateURL = !localStorage.getItem("disable-save-on-type")
                if (alwaysUpdateURL) {
                  location.hash = `#gist/${gistID}-${i}`
                }
                return false
              }
              li.appendChild(a)

              break
            }
            case "hr": {
              const hr = document.createElement("hr")
              li.appendChild(hr)
            }
          }
          ul.appendChild(li)
        })
        nav.appendChild(ul)

        const targetedLi = ul.children.item(Number(gistStoryIndex) || 0) || ul.children.item(0)
        if (targetedLi) {
          const a = targetedLi.getElementsByTagName("a").item(0)
          // @ts-ignore
          if (a) a.click()
        }
      }
    })
    .catch(() => {
      ui.flashInfo("Could not reach the gist to playground API, are you (or it) offline?")
      playground.style.opacity = "1"
      sandbox.editor.updateOptions({ readOnly: false })
    })
}
