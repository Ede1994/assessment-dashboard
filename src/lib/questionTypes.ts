export type QuestionTypeName = "FREE_TEXT" | "MULTIPLE_CHOICE" | "CODING";

export function questionTypeLabel(type: string, short = false): string {
  switch (type) {
    case "MULTIPLE_CHOICE":
      return short ? "MC" : "Multiple choice";
    case "CODING":
      return short ? "Code" : "Coding exercise";
    default:
      return short ? "Text" : "Free text";
  }
}
