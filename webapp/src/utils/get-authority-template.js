const getAuthoritTemplate = (key) => {
  return {
    threshold: 1,
    keys: [{ weight: 1, key: key || '' }],
    accounts: [],
    waits: []
  }
}

export default getAuthoritTemplate
