const url = import.meta.env.REACT_APP_HASURA_URL || ''

// A path such as /v1/graphql means "on this site": in production the webapp's
// nginx proxies it to the network's Hasura, so the build works on any hostname.
export const graphqlConfig = {
  url: url.startsWith('/') ? `${window.location.origin}${url}` : url,
}
