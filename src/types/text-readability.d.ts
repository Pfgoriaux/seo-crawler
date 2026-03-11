declare module 'text-readability' {
  interface Readability {
    fleschKincaidGrade(text: string): number;
    fleschReadingEase(text: string): number;
    smogIndex(text: string): number;
    colemanLiauIndex(text: string): number;
    automatedReadabilityIndex(text: string): number;
    textStandard(text: string): string;
    syllableCount(text: string): number;
    lexiconCount(text: string, removePunctuation?: boolean): number;
    sentenceCount(text: string): number;
  }
  const readability: Readability;
  export default readability;
}
