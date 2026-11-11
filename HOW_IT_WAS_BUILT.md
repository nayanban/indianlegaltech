# How I Built the India Legal Market Note Explorer

*An account of the advisory problem, the product choices, and the role AI played.*

## Why I built it

I prepared an India legal market note as an advisor for a company. A reader may have a specific question rather than time to read the whole document. I wanted to make the note easier to use while retaining a distinction that matters in advisory work: what the document establishes, what it only suggests, and what still calls for research.

That shaped the core requirement. A reader should be able to ask a question in their own words and get an answer grounded in the note. If the note does not contain enough information, the tool should say so clearly and identify the next questions to investigate. A confident-sounding answer without a visible basis would work against the purpose of the project.

## Defining the answer standard

I specified an answer with its level of support, a direct response, cited passages, and a concise account of its scope. Further research questions extend the inquiry; when the note only partly answers, or cannot answer, the question, the missing fact is named specifically. The note's opening preliminary analysis is labelled separately from later market notes so an early hypothesis is not presented as an established market finding.

The interface allows free-form questions; it is not a fixed FAQ. The answer service selects likely relevant paragraphs from the private note, sends only those paragraphs and the question to the model, and asks for a structured response. The service checks that returned citation IDs refer to passages actually supplied. That check narrows one failure mode, but the reader must still decide whether a passage truly supports the interpretation.

## Protecting the source material

The repository is public so the interface and implementation can be inspected. The advisory note is private. I chose a split design: GitHub Pages hosts the interface and an encrypted copy of the note. The browser derives a note key from an authorized reader's shared passphrase, and a serverless service uses that key to decrypt its encrypted copy in memory. The original 600,000-iteration password derivation stays in the browser because the hosting runtime limits server-side derivation. The plaintext note, passphrase, and API key are absent from the repository.

The passphrase is a practical access method for a small group. It also has a clear limit: everyone with the passphrase has the same access, and an individual reader cannot be revoked without replacing the passphrase and re-encrypting the note. The public page therefore explains the project without revealing the note or offering a sample answer from it.

## Keeping the architecture small

The frontend is plain HTML, CSS, and JavaScript deployed through GitHub Pages. There is no account system or database. The answer service handles decryption, passage selection, model requests, and citation validation. This separation keeps the API key out of the browser and avoids sending the entire note for each question.

The retrieval method is deliberately simple: keyword matching chooses a bounded set of passages. This suits a first pilot, but it can miss a relevant section when a reader uses a synonym or different framing. The answer is therefore limited to the passages retrieved for that request, and the interface tells readers to inspect cited text before relying on a conclusion. The tool does not browse the web or verify that time-sensitive observations remain current. Those standing limits are explained once in the interface instead of making every answer sound incomplete.

## My role and AI's role

I authored the advisory note and set the product direction: question-led access, source-backed answers, visible uncertainty, and private source material. I used Codex for code generation and implementation, then reviewed the behavior and constraints against that brief. The project demonstrates how I translated an advisory standard into an interface, with AI assisting the build rather than serving as the source of the underlying market judgment.

The repository includes tests for decryption, access checks, and evidence validation. The GitHub Pages workflow runs those tests before publishing the static interface. The live answer service uses GPT-6 Luna with a privately configured API key and a small prepaid balance. An initial end-to-end check returned a partial answer with cited passages, limitations, and research questions; an unrelated question was marked unavailable.

## What I would test next

In a broader reader pilot, I would test questions that the note can answer, questions it can only partly answer, and questions outside its scope. The important review is whether each cited passage actually supports the wording of the answer, whether preliminary material is labelled correctly, and whether the proposed research questions identify a useful next step. Those checks matter more than making every response sound complete.

---

[Open the project site](https://nayanban.github.io/indianlegaltech/) · [Browse the repository](https://github.com/nayanban/indianlegaltech) · [Nayan Banerjee on LinkedIn](https://www.linkedin.com/in/banerjee-nayan/)
