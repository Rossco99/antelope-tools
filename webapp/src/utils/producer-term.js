// Some networks have their own name for block producers (WAX calls them
// Guilds). Rewrites the English texts with that term, leaving technical names
// such as bp.json, the producers table and regproducer untouched.
const replacements = (term) => {
  const lower = term.toLowerCase()

  return [
    [/\bBlock Producers\b/g, `${term}s`],
    [/\bBlock Producer\b/g, term],
    [/\bblock producers\b/g, `${lower}s`],
    [/\bblock producer\b/g, lower],
    [/\bProducers\b/g, `${term}s`],
    [/\bProducer\b/g, term],
    [/(?<!table of )\bproducers\b(?! table)/g, `${lower}s`],
    [/\bproducer\b/g, lower],
    [/\bBPs\b/g, `${term}s`],
    [/\bBP (Profile|Agreement|Details|data)\b/g, `${term} $1`],
  ]
}

export const applyProducerTerm = (texts, term) => {
  if (!term) return texts

  const rules = replacements(term)
  const rewrite = (value) => {
    if (typeof value === 'string') {
      return rules.reduce((text, [pattern, to]) => text.replace(pattern, to), value)
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, rewrite(item)]),
      )
    }

    return value
  }

  return rewrite(texts)
}
