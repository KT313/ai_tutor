// German tutor prompts and UI labels, copied verbatim from german_og/site.html.
// Phase E replaces this with locale JSON lookups keyed by UI language.

export const contextLabels = {
  theme: 'Thema',
  overview: 'Überblick',
  bulletPoints: 'Relevante Stichpunkte',
  tutorHint: 'Zusatzinfo für Tutor',
};

export const systemPromptInfo = `Du bist ein erfahrener und freundlicher Tutor. Du hilfst einem Studenten bei der Klausurvorbereitung.
Der Student schreibt bald die Klausur und muss diese unbedingt bestehen. Dein Ziel ist es, dem Studenten möglichst schnell alles Relevante beizubringen, was er wissen muss, um die Klausur sicher zu bestehen.
Um das zu erreichen stellst du dem Studenten mögliche Klausurfragen.
Dies ist außerdem ein benchmark für dich. Deine Intelligenz und deine Fertigkeiten werden daran bewertet, wie gut du den Studenten auf die Klausur vorbereitest.
Info: Nutze keine genesteten text-formattierungen wie **dies ist ein __text__** dem Studenten nicht richtig angezeigt wird. Nutze stattdessen zB **dies ist ein** __text__.`;

export const optionalInstruction = `Bitte stelle alle Fragen zu den Inhalten auf einmal.`;

export const firstQuestionTemplate = (topic: string): string =>
  `Deine erste Aufgabe ist es, eine prägnante Frage oder Aufgabe zum Thema "${topic}" zu erstellen. Die Frage soll klar strukturiert (mit Teilaufgaben falls umfangreich) und von der Schwierigkeit her leicht bis mittel sein. Sobald die Aufgabe / Frage beantwortet wurde und es sind noch mehr Aufgaben / Fragen übrig, stelle gleich die Nächste. Bei mehreren kurzen Fragen zum gleichen Thema kannst du auch Mehrere auf einmal stellen.`;

export const newQuestionRequest = `Stelle eine neue Frage oder Aufgabe zum Thema.`;

export const evaluationPrompt = `Bewerte die obige Antwort des Studenten.
Sei konstruktiv und freundlich.
Führe die korrektur für jede Teilaufgabe folgendermaßen durch:
1. Wiederholen der Antwort des Studenten, wobei problematische Stellen markiert sind.
Falls die Antwort des Studenten nicht perfekt war, Schritt 2 + 3 durchführen:
2. Zeigen der verbesserten Antwort des Studenten, wie sie ergänzt / korrigiert aussehen müsste, um die Aufgabe korrekt zu beantworten.
3. Erklärung der Ergänzungen / Änderungen.
Falls zusätzliche Informationen für die Antwort relevant sind (zB falls nach einer Beschreibung von 2 von 4 Begriffen gefragt ist), Schritt 4 durchführen:
4. Zusätzliche Informationen kompakt auflisten (zB die restlichen Beschreibungen zeigen, die mögich gewesen wären)
Erklärungen die schnell und einfach zu verstehen sind sind bevorzugt.`;

export const uiStrings = {
  apiKeyLabel: 'Gemini API Key (optional):',
  apiKeyPlaceholder: 'Falls von Umgebung nicht bereitgestellt...',
  apiKeySave: 'Speichern',
  apiKeySaved: 'Gespeichert!',
  allAtOnce: 'all at once',
  askTutor: '✨ Tutor fragen',
  tutorModalTitle: 'Tutor',
  answerPlaceholder: 'Ihre Antwort hier...',
  submitAnswer: 'Antwort senden',
  newQuestion: 'Neue Frage stellen',
  removeLast: 'Letzte löschen',
  clearHistory: 'Verlauf löschen',
  followUpPlaceholder: 'Stellen Sie eine Folgefrage oder bitten Sie um weitere Erklärungen...',
  sendFollowUp: 'Frage senden',
  confirmClearHistory: 'Möchten Sie wirklich den gesamten Verlauf für dieses Thema löschen?',
  labelQuestion: 'Frage',
  labelYourAnswer: 'Ihre Antwort',
  labelEvaluation: 'Tutor-Bewertung',
  labelYourQuestion: 'Ihre Frage',
  labelTutorAnswer: 'Tutor-Antwort',
  errorNoApiKey: 'Bitte geben Sie zuerst einen API-Schlüssel ein.',
  errorEmptyAnswer: 'Bitte geben Sie eine Antwort ein.',
  errorEmptyFollowUp: 'Bitte geben Sie eine Frage ein.',
  errorPrefix: 'Ein Fehler ist aufgetreten',
};
