export const VULGAR_WORDS = [
  "fuck",
  "shit",
  "damn",
  "bitch",
  "asshole",
  "bastard",
  "crap",
  "piss",
  "slut",
  "whore",
  "faggot",
  "nigger",
  "retard",
  "gay",
  "stupid",
  "idiot",
  "moron",
  "dumb",
  "kill yourself",
  "kys",
]

export function containsVulgarContent(content: string): boolean {
  const cleanContent = content.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, " ")

  return VULGAR_WORDS.some((word) => cleanContent.includes(word.toLowerCase()))
}

export function moderateContent(content: string): { isClean: boolean; reason?: string } {
  if (containsVulgarContent(content)) {
    return {
      isClean: false,
      reason: "Content contains inappropriate language",
    }
  }

  return { isClean: true }
}
